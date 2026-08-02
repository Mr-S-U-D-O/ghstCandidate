import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabaseAdmin';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export const joinWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, surname, email, phone, inform_on_launch, keep_posted } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    if (inform_on_launch === undefined) {
      res.status(400).json({ error: 'inform_on_launch is required.' });
      return;
    }

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert([
        {
          name,
          surname,
          email,
          phone,
          inform_on_launch,
          keep_posted
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase waitlist insert error:', error);
      res.status(500).json({ error: 'Failed to join waitlist.' });
      return;
    }

    // Send Welcome Email via Resend
    try {
      await resend.emails.send({
        from: 'Ghost Beta <onboarding@resend.dev>', // Assuming using Resend testing domain
        to: email,
        subject: "You're on the list - Ghost Beta",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
            <h2 style="font-weight: 300; letter-spacing: -0.02em;">Welcome to the Ghost waitlist.</h2>
            <p>Hi ${name || 'there'},</p>
            <p>Thank you for your interest in the Ghost closed beta. We've secured your spot in the queue.</p>
            <p>We'll notify you as soon as we open up more access.</p>
            <br/>
            <p style="color: #666; font-size: 14px;">— The Ghost Team</p>
          </div>
        `
      });
      console.log(`Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('Resend email error:', emailError);
      // We don't fail the request if the email fails, they are still on the waitlist
    }

    res.status(200).json({ message: "Successfully joined waitlist", data });
  } catch (error) {
    console.error('Waitlist Controller Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
