import { Request, Response } from "express";
import { Stagehand } from "@browserbasehq/stagehand";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient.js";
import { generateBespokeDocs } from "./jobController.js";
import type { CandidateProfile } from "./jobController.js";

// ── Types ────────────────────────────────────────────────────────────

interface RunAgentBody {
  jobId: string;
  jobUrl: string;
  candidateProfile: CandidateProfile;
  userId: string;
  jobTitle?: string;
  company?: string;
}

// ── Stagehand extraction schema ─────────────────────────────────────
// Removed FormStateSchema to save LLM tokens.

// ── Agent Controller ─────────────────────────────────────────────────

async function fetchCandidateProfile(userId: string, scopedSupabase: any) {
  const { data, error } = await scopedSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error(
      `[runAgent] ⚠️ Failed to fetch candidate profile from DB:`,
      error.message,
    );
    return {};
  }
  return data || {};
}

export async function runAgent(req: Request, res: Response): Promise<void> {
  const { jobId, jobUrl, candidateProfile, userId, jobTitle, company } =
    req.body as RunAgentBody;

  console.log(`\n===========================================`);
  console.log(`[runAgent] Autonomous agent starting.`);
  console.log(`[runAgent] User ID: ${userId}`);
  console.log(`[runAgent] Job ID: ${jobId}`);
  console.log(`[runAgent] Job URL: ${jobUrl}`);
  console.log(`===========================================`);

  // ── Input validation ───────────────────────────────────────────────
  if (!jobId || !jobUrl || !userId || !candidateProfile) {
    console.warn(`[runAgent] Missing required parameters. Aborting.`);
    res
      .status(400)
      .json({
        error: "Bad Request",
        message:
          "jobId, jobUrl, userId, and candidateProfile are all required.",
      });
    return;
  }

  // ── Build scoped Supabase client (RLS bypass) ───────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn(
      `[runAgent] \u26a0\ufe0f Missing Authorization header. RLS operations may fail.`,
    );
  }
  let scopedSupabase = supabase;
  if (authHeader) {
    scopedSupabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    console.log(`[runAgent] Scoped Supabase client created with user JWT.`);
  }

  // ── Fetch candidate memories ───────────────────────────────────────
  let memories: { memory_key: string; memory_value: string }[] = [];
  console.log(`[runAgent] Fetching candidate memories for user ${userId}...`);
  const { data: memData, error: memErr } = await scopedSupabase
    .from("candidate_memories")
    .select("memory_key, memory_value")
    .eq("user_id", userId);
  if (memErr) {
    console.error(`[runAgent] \u26a0\ufe0f Failed to fetch memories:`, memErr);
  } else {
    memories = memData || [];
    console.log(`[runAgent] \u2705 Fetched ${memories.length} memories.`);
  }

  // ── Fetch DB Candidate Profile ─────────────────────────────────────
  console.log(
    `[runAgent] Fetching core candidate profile for user ${userId}...`,
  );
  const dbProfile = await fetchCandidateProfile(userId, scopedSupabase);
  console.log(`[runAgent] ✅ Fetched candidate profile from DB.`);

  // ── Build profile context string ───────────────────────────────────
  const memoriesText =
    memories.length > 0
      ? `\nLearned Facts:\n${memories.map((m) => `- ${m.memory_key}: ${m.memory_value}`).join("\n")}`
      : "";

  const profileContext = `
Candidate Name: ${dbProfile.first_name || ''} ${dbProfile.last_name || dbProfile.name || ''}
Email: ${dbProfile.email || ''}
Phone: ${dbProfile.phone || ''}
LinkedIn: ${dbProfile.linkedin_url || ''}
GitHub: ${dbProfile.github_url || ''}
Portfolio: ${dbProfile.portfolio_url || ''}

Authorized to Work: ${dbProfile.auth_to_work ? 'Yes' : 'No'}
Needs Sponsorship: ${dbProfile.needs_sponsorship ? 'Yes' : 'No'}
Felony Conviction: ${dbProfile.felony_conviction ? 'Yes' : 'No'}
Education Level: ${dbProfile.education_level || ''}
Major: ${dbProfile.highest_degree_major || ''}
Years of Experience: ${dbProfile.years_of_experience || 0}
Salary Expectation: ${dbProfile.salary_expectation || ''}
Notice Period: ${dbProfile.notice_period || ''}
Willing to Relocate: ${dbProfile.willing_to_relocate ? 'Yes' : 'No'}
Work Environment: ${dbProfile.work_environment || ''}
Willing to Travel: ${dbProfile.willing_to_travel || ''}

Skills: ${(dbProfile.skills || []).join(", ")}
Target Roles: ${(dbProfile.target_roles || []).join(", ")}
Locations: ${(dbProfile.locations || []).join(", ")}
${memoriesText}
`.trim();

  // ── Helper: update job status in Supabase ──────────────────────────
  async function updateJobStatus(updates: Record<string, unknown>) {
    const { error } = await scopedSupabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId);
    if (error) {
      console.error(`[runAgent] \u274c Failed to update job status:`, error);
    } else {
      console.log(`[runAgent] \u2705 Job status updated:`, updates);
    }
  }

  // ── Initialize Stagehand ───────────────────────────────────────────
  console.log(`[runAgent] Initializing Stagehand (LOCAL mode) with NVIDIA DeepSeek V4...`);

  const stagehand: any = new Stagehand({
    env: "LOCAL",
    model: {
      modelName: "openai/deepseek-ai/deepseek-v4-flash",
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1"
    },
    verbose: 1,
    localBrowserLaunchOptions: {
      headless: false,
    },
  });

  try {
    await stagehand.init();
    console.log(`[runAgent] ✅ Stagehand initialized.`);

    const page = stagehand.page || stagehand.context?.activePage();

    // ── Step 5: Navigate ───────────────────────────────────────────
    console.log(`[runAgent] Navigating to: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // ── Multi-Step Execution Loop ──────────────────────────────────
    let stepCount = 0;
    const MAX_STEPS = 50;
    let isSubmitted = false;
    let hasGeneratedDocs = false;

    while (stepCount < MAX_STEPS && !isSubmitted) {
      stepCount++;
      console.log(`[runAgent] --- Loop Iteration ${stepCount} ---`);

      // 1. Triage: Check for Login Wall
      const isLoginWall = await page
        .evaluate(() => {
          if (!document || !document.body) return false;
          const text = document.body.innerText.toLowerCase();
          return (
            text.includes("sign in to apply") ||
            text.includes("connect with linkedin") ||
            document.querySelector('input[type="password"]') !== null
          );
        })
        .catch(() => false);

      if (isLoginWall) {
        console.warn(
          `[runAgent] ❌ Login wall detected. Aborting agent — no docs generated (tokens saved).`,
        );
        await stagehand.close();
        await updateJobStatus({
          column: "review",
          needs_input: true,
          missing_field: "Requires manual login or account creation.",
        });
        res.status(200).json({
          success: false,
          status: "REQUIRES_LOGIN",
          missingField:
            "Login wall detected — this job requires you to sign in manually before applying.",
        });
        return;
      }

      // 2. JIT Document Upload

      // ── Step 8: Deterministic JIT File Upload Check ────────────────
      console.log("[runAgent] Checking for file upload fields...");
      let hasFileUpload = false;
      const isKnownAts = ['greenhouse.io', 'lever.co', 'workable.com'].some(domain => jobUrl.toLowerCase().includes(domain));
      
      if (isKnownAts) {
        console.log(`[runAgent] 💡 Known ATS detected (${jobUrl}). Bypassing hidden input checks and assuming file upload exists.`);
        hasFileUpload = true;
      } else {
        hasFileUpload = await page
          .evaluate(() => {
            if (!document) return false;
            return document.querySelector('input[type="file"]') !== null;
          })
          .catch(() => false);
      }

      if (hasFileUpload && !hasGeneratedDocs) {
        console.log(
          `[runAgent] 📎 File upload detected. Triggering JIT document generation...`,
        );

        // Capture JD text inline from current page (we're already on it)
        let jdText = "";
        try {
          const raw = await page.evaluate(
            () => document.body.innerText?.trim() ?? "",
          );
          jdText = raw.slice(0, 6000);
          console.log(`[runAgent] JD text captured: ${jdText.length} chars`);
        } catch (e) {
          console.warn(`[runAgent] Could not capture JD text inline:`, e);
        }

        let docs;
        const { data: existingDocs } = await scopedSupabase
          .from('generated_docs')
          .select('resume_url, cover_letter_url')
          .eq('job_id', jobId)
          .maybeSingle();

        if (existingDocs && existingDocs.resume_url) {
          console.log(`[runAgent] Existing JIT documents found. Bypassing generation.`);
          try {
            const pdfRes = await fetch(existingDocs.resume_url);
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            docs = {
              resumeUrl: existingDocs.resume_url,
              coverLetterUrl: existingDocs.cover_letter_url,
              resumePdfBuffer: pdfBuffer
            };
          } catch (e) {
            console.warn(`[runAgent] Failed to fetch existing PDF, falling back to generation:`, e);
          }
        }

        if (!docs) {
          docs = await generateBespokeDocs({
            jdText,
            candidateProfile,
            memories,
            userId,
            jobId,
            jobTitle: jobTitle || "Unknown Role",
            company: company || "Unknown Company",
            scopedSupabase,
          });
        }
        
        hasGeneratedDocs = true;
        console.log(
          `[runAgent] \u2705 JIT docs ready. Resume URL: ${docs.resumeUrl}`,
        );

        // Upload PDF to file input
        try {
          // Forcefully make the file input interactable if it is hidden by CSS (often the case for ATS)
          await page.evaluate(() => {
            const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
            if (fileInput) {
              fileInput.style.display = 'block';
              fileInput.style.visibility = 'visible';
              fileInput.style.opacity = '1';
            }
          }).catch(() => {});

          await page
            .locator('input[type="file"]')
            .first()
            .setInputFiles({
              name: `${(candidateProfile.name || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`,
              mimeType: "application/pdf",
              buffer: docs.resumePdfBuffer,
            }, { force: true } as any);
          console.log(`[runAgent] \u2705 Resume PDF set on file input.`);
        } catch (fileErr) {
          console.warn(
            `[runAgent] \u26a0\ufe0f setInputFiles failed (may still proceed):`,
            fileErr,
          );
        }
      } else if (!hasGeneratedDocs) {
        console.log(
          `[runAgent] No file upload input present. Skipping JIT doc generation (tokens saved).`,
        );
      }

      // 2.5 Defensive DOM Pruning (Anti-SSO Protocol)
      console.log("[runAgent] Pruning decoy SSO buttons from DOM...");
      await page.evaluate(() => {
        const forbiddenTexts = [
          'apply with linkedin',
          'apply with indeed',
          'quick apply',
          'sign in to apply'
        ];
        
        const elements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
        elements.forEach(el => {
          const text = (el.textContent || (el as HTMLInputElement).value || '').toLowerCase().trim();
          if (forbiddenTexts.some(forbidden => text.includes(forbidden))) {
            el.remove();
          }
        });
      }).catch((e: unknown) => console.warn("[runAgent] DOM pruning non-fatal error:", e));

      // 3. Stagehand Action
      console.log("[runAgent] Executing Stagehand act()...");
      const instruction = `
  You are an automated job application agent. 
  1. If you see application form fields, fill them out accurately using this candidate profile data:
${profileContext}
  2. Use these specific memories for nuanced or custom questions: ${JSON.stringify(memories)}.
  3. CRITICAL: If you encounter a mandatory form question you cannot answer using the provided profile or memories, immediately stop and throw an error starting exactly with "NEEDS_INPUT: " followed by the question text.
  4. CRITICAL SELF-HEALING REFLEX: If you click 'Submit' and the page does not transition, OR if you observe a red form validation error (e.g., 'Resume/CV is required', 'This field is required'), DO NOT click submit again immediately. You must observe the error, find the missing or incorrect field, and act to fix it (e.g., fill in the missing text). ONLY attempt to click 'Submit' again after attempting a fix. IF the error asks for a file you do not have, or information you do not know, THEN you must immediately STOP and throw a fatal error starting with 'NEEDS_INPUT:'.
  5. EXHAUSTIVE EXECUTION RULE: You MUST scroll down and verify every single input field on the page. Do NOT click submit until you have actively verified there are no empty mandatory dropdowns, checkboxes, or textboxes remaining. You must proactively identify and fill EVERY single required input field before attempting to click the 'Submit' button. IF a required field asks a question that cannot be answered using the provided candidate profile context, you MUST immediately STOP and throw a fatal error starting exactly with 'NEEDS_INPUT: [Name of the specific missing field]'.
  
  NAVIGATION & MODAL RULES:
  6. AGGREGATOR GATEWAYS: If you land on an intermediary job board (e.g., Jobicy, WeWorkRemotely, RemoteOK), your primary goal is to find the link that routes to the employer's direct website. Click buttons like 'Apply for this job', 'Apply Now', or 'Continue on employer website'.
  7. MODAL DISAMBIGUATION (GUEST OVERRIDE RULE): If a modal or popup appears offering options like 'Sign Up and Apply', 'Log In', or 'Continue as Guest' / 'Apply without account', you MUST EXCLUSIVELY choose 'Continue as Guest' or 'Apply without account'. If you see a button or link that says 'Apply on Company Site', 'Apply on Employer Website', or 'View on Employer Website', click it IMMEDIATELY and without hesitation. NEVER select options that require creating an aggregator account.
  8. REAL ATS TARGET RECOGNITION: Your navigation phase is COMPLETE when you land on an application form with actual candidate input fields (e.g. First Name, Email, Resume Upload) or an ATS domain (greenhouse.io, lever.co, ashbyhq.com, workable.com). Once on this page, transition immediately to filling out the form.
  9. BACKTRACK PROTOCOL: If an action redirects you to an email verification, 2FA, login screen, OR any page that is NOT the application form AND NOT a known ATS domain, STOP immediately. Do not attempt to log in. Navigate back using page.goBack() and attempt an alternative path to reach the application form.
  10. ANTI-SHORTCUT RULE: You are strictly FORBIDDEN from clicking any buttons that say 'Apply with LinkedIn', 'Apply with Indeed', 'Quick Apply with MyGreenhouse', 'Sign In', or any other third-party login or SSO shortcuts. You MUST stay on the current page and fill out the raw application form manually.
  11. ANTI-LOOP & ANCHOR LINK RULE: On platforms like Greenhouse, the 'Apply' button at the top of the page is often just an anchor link that scrolls down. If you see application input fields (e.g., First Name, Last Name, Email, Resume Upload) anywhere in the DOM, you MUST prioritize filling them out immediately. DO NOT click 'Apply' or 'Apply Now' buttons if the form fields are already present on the page, or you will get trapped in an infinite click loop. Stop clicking anchors and start typing.
  12. FILE UPLOAD IGNORANCE RULE: If the system has already attached PDF documents to the file input fields on this page (i.e., resume and cover letter have already been uploaded), you MUST ignore any additional file upload buttons or inputs. Do NOT attempt to re-upload or replace already-attached documents. Proceed directly to filling out any remaining text, dropdown, or checkbox fields.
      `.trim();

      try {
        let actResult;
        let actAttempts = 0;
        while (actAttempts < 3) {
          actAttempts++;
          try {
            actResult = await stagehand.act(instruction);
            break;
          } catch (innerErr: any) {
            const msg: string = innerErr?.message ?? String(innerErr);
            if (msg.includes("529") || msg.includes("429") || msg.includes("AI_PROVIDER_OVERLOADED")) {
              if (actAttempts < 3) {
                const delay = actAttempts === 1 ? 5000 : 10000;
                console.warn(`[runAgent] ⚠️ Upstream AI provider overloaded. Retrying in ${delay}ms (Attempt ${actAttempts}/3)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            throw innerErr;
          }
        }
        
        console.log(
          `[runAgent] ✅ Stagehand act() completed iteration ${stepCount}.`,
        );

        // 3.5 URL & Navigation State Tracking
        const currentUrl = page.url();
        const lowerUrl = currentUrl.toLowerCase();
        
        if (lowerUrl.includes('greenhouse.io') || lowerUrl.includes('lever.co') || lowerUrl.includes('ashbyhq.com') || lowerUrl.includes('workable.com')) {
          console.log(`[runAgent] 🎯 Target ATS reached: ${currentUrl}`);
        }

        if (lowerUrl.includes('/login') || lowerUrl.includes('/signup') || lowerUrl.includes('/auth') || lowerUrl.includes('/signin')) {
          console.warn(`[runAgent] ⚠️ Agent hit a login/auth wall at ${currentUrl}. Executing BACKTRACK PROTOCOL...`);
          await page.goBack({ waitUntil: 'networkidle' }).catch((e: unknown) => console.warn("[runAgent] ⚠️ Backtrack failed:", e));
          console.log(`[runAgent] 🔙 Backtracked to: ${page.url()}`);
        }

        if (actResult && actResult.success === false) {
          const failureMsg = `Agent paralyzed: ${actResult.message || 'Unknown failure'}`;
          console.warn(`[runAgent] ⚠️ ${failureMsg}`);
          await stagehand.close();
          await updateJobStatus({
            column: "review",
            needs_input: true,
            missing_field: failureMsg,
          });
          res.status(200).json({
            success: false,
            status: "NEEDS_INPUT",
            missingField: failureMsg,
          });
          return;
        }
      } catch (actErr: any) {
        const msg: string = actErr?.message ?? String(actErr);
        if (msg.toLowerCase().includes("needs_input")) {
          const unknownQ = msg.replace(/^.*NEEDS_INPUT:\s*/i, "").trim();
          console.warn(
            `[runAgent] \u26a0\ufe0f NEEDS_INPUT thrown during fill: "${unknownQ}"`,
          );
          await stagehand.close();
          await updateJobStatus({
            needs_input: true,
            missing_field: `NEEDS_INPUT: ${unknownQ}`,
          });
          res
            .status(200)
            .json({
              success: false,
              status: "NEEDS_INPUT",
              missingField: unknownQ,
            });
          return;
        }

        if (msg.includes("529") || msg.includes("429") || msg.includes("AI_PROVIDER_OVERLOADED")) {
          const overloadMsg = "AI Provider is currently overloaded (HTTP 529). Please try again in a few minutes.";
          console.warn(`[runAgent] ⚠️ ${overloadMsg}`);
          await stagehand.close();
          await updateJobStatus({
            column: "review",
            needs_input: true,
            missing_field: overloadMsg,
          });
          res.status(200).json({
            success: false,
            status: "NEEDS_INPUT",
            missingField: overloadMsg,
          });
          return;
        }

        throw actErr;
      }

      // 4. Check for Success
      const hasSuccessMessage = await page
        .evaluate(() => {
          if (!document || !document.body) return false;
          const text = document.body.innerText.toLowerCase();
          return (
            text.includes("application submitted") ||
            text.includes("thank you for applying")
          );
        })
        .catch(() => false);

      if (hasSuccessMessage) {
        isSubmitted = true;
        console.log("[runAgent] ✅ Application successfully submitted.");
      } else {
        // Wait a moment for network to settle before next loop iteration
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    if (!isSubmitted) {
      console.warn(
        `[runAgent] ⚠️ Reached MAX_STEPS (${MAX_STEPS}) without confirming submission.`,
      );
      await stagehand.close();
      await updateJobStatus({
        column: "review",
        needs_input: true,
        missing_field: "Max steps reached without confirmed submission.",
      });
      res
        .status(200)
        .json({
          success: false,
          status: "NEEDS_INPUT",
          missingField: "Max steps reached without confirmed submission.",
        });
      return;
    }

    // ── Success ────────────────────────────────────────────────────
    await stagehand.close();
    console.log(
      `[runAgent] \u2705 Agent complete. Updating job column to 'applied'.`,
    );

    await updateJobStatus({
      column: "applied",
      needs_input: false,
      missing_field: null,
    });

    res.status(200).json({
      success: true,
      status: "APPLIED",
      message: "The Ghost has successfully submitted your application.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runAgent] \u274c Unhandled error in agent loop:`, message);

    try {
      await stagehand.close();
    } catch {}

    if (message.toLowerCase().includes("needs_input")) {
      const unknownQ = message.replace(/^.*NEEDS_INPUT:\s*/i, "").trim();
      console.warn(
        `[runAgent] NEEDS_INPUT caught in top-level handler: "${unknownQ}"`,
      );
      await updateJobStatus({
        needs_input: true,
        missing_field: `NEEDS_INPUT: ${unknownQ}`,
      });
      res
        .status(200)
        .json({
          success: false,
          status: "NEEDS_INPUT",
          missingField: unknownQ,
        });
      return;
    }

    if (message.includes("529") || message.includes("429") || message.includes("AI_PROVIDER_OVERLOADED")) {
      const overloadMsg = "AI Provider is currently overloaded (HTTP 529). Please try again in a few minutes.";
      console.warn(`[runAgent] ⚠️ ${overloadMsg}`);
      await updateJobStatus({
        column: "review",
        needs_input: true,
        missing_field: overloadMsg,
      });
      res.status(200).json({
        success: false,
        status: "NEEDS_INPUT",
        missingField: overloadMsg,
      });
      return;
    }

    res.status(500).json({ error: "Internal Server Error", message });
  }
}
