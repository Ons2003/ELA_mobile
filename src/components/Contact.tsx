import React, { useState } from 'react';
import { Clock, Instagram, Mail, MapPin } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (field: 'name' | 'email' | 'topic' | 'message', value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setFeedback({ type: 'error', message: 'Please fill in your name, email, and message.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          topic: formData.topic || undefined,
          message: formData.message,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Sorry, something went wrong when sending your message.');
      }

      setFeedback({
        type: 'success',
        message: "Thanks for reaching out! I'll get back to you as soon as possible.",
      });
      setFormData({
        name: '',
        email: '',
        topic: '',
        message: '',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Sorry, something went wrong when sending your message. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-16 sm:py-20 bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="bg-white/10 text-white">
            Get in Touch
          </Badge>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Ready to start your strength journey?</h2>
          <p className="mt-3 text-base text-white/70 max-w-3xl mx-auto">
            Have questions about programs or coaching? Reach out and I will respond within 24 hours.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Let us connect</CardTitle>
              <CardDescription className="text-white/70">
                Direct access for program details, partnerships, and coaching questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <Mail className="h-5 w-5 text-red-300" />
                <div>
                  <p className="text-sm font-semibold">Email</p>
                  <a href="mailto:elyesaccademylift@gmail.com" className="text-sm text-white/70">
                    elyesaccademylift@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <Instagram className="h-5 w-5 text-red-300" />
                <div>
                  <p className="text-sm font-semibold">Instagram</p>
                  <a href="https://www.instagram.com/elyes_zerai" className="text-sm text-white/70">
                    @elyes_zerai
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <MapPin className="h-5 w-5 text-red-300" />
                <div>
                  <p className="text-sm font-semibold">Location</p>
                  <p className="text-sm text-white/70">Tunis, Tunisia - Online coaching worldwide</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <Clock className="h-5 w-5 text-red-300" />
                <div>
                  <p className="text-sm font-semibold">Response time</p>
                  <p className="text-sm text-white/70">Within 24 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Quick message</CardTitle>
              <CardDescription className="text-white/70">
                Send a note and I will reach out with the next steps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  required
                />
                <Select
                  value={formData.topic || undefined}
                  onValueChange={(value) => handleChange('topic', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Program Information">Program Information</SelectItem>
                    <SelectItem value="Pricing Questions">Pricing Questions</SelectItem>
                    <SelectItem value="Free Consultation">Free Consultation</SelectItem>
                    <SelectItem value="Partnership Inquiry">Partnership Inquiry</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="How can I help you?"
                  value={formData.message}
                  onChange={(event) => handleChange('message', event.target.value)}
                  required
                />

                {feedback && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      feedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-500/10 text-emerald-100'
                        : 'border-red-200 bg-red-500/10 text-red-100'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Contact;
