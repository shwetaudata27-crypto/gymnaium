import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { reviewApi } from '@/services/apiService';

const Review = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const clientId = searchParams.get('clientId') || '';
  const prefillName = searchParams.get('name') || '';

  const [name, setName] = useState(prefillName);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast({ title: 'Review required', description: 'Please share your feedback before submitting.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await reviewApi.create({
        clientId: clientId || undefined,
        name: name.trim() || 'Guest',
        rating,
        feedback: feedback.trim(),
      });

      toast({ title: 'Review submitted', description: 'Thank you for sharing your feedback!' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Submission failed', description: error instanceof Error ? error.message : 'Unable to submit review.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-10">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              Share Your Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
            </div>

            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <Button
                    key={score}
                    variant={rating === score ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setRating(score)}
                    className="gap-2"
                  >
                    <Star className="w-4 h-4" />
                    {score}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={7}
                placeholder="Tell us what you liked and how we can improve."
              />
            </div>

            <div className="text-sm text-muted-foreground">
              {clientId ? 'Thank you for taking a moment to share your experience with US Gymnasium.' : 'Submit your review and help us improve every workout experience.'}
            </div>

            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Review;
