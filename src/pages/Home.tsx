import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GymHeader } from '@/components/gym/GymHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dumbbell, UserPlus, ScanLine, ShieldCheck, LogOut, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGym } from '@/context/GymContext';
import { reviewApi } from '@/services/apiService';
import { Review } from '@/types/gym';

const Home = () => {
  const { toast } = useToast();
  const { lockGate } = useGym();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  const handleLogout = () => {
    lockGate();
    toast({ title: 'Logged out', description: 'You have been signed out.' });
  };

  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      setIsReviewsLoading(true);
      try {
        const data = await reviewApi.getAll();
        if (active) setReviews(data || []);
      } catch (error) {
        console.error('Failed to load reviews', error);
      } finally {
        if (active) setIsReviewsLoading(false);
      }
    };

    loadReviews();
    return () => {
      active = false;
    };
  }, []);

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const renderStars = (count: number) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${index < count ? 'text-amber-500' : 'text-muted-foreground'}`}
      />
    ));

  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-16 animate-slide-up">
          <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary to-gym-gold glow mb-6 w-fit">
            <Dumbbell className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-4">
            US Gymnasium
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Complete gym management solution with member registration, payment
            tracking, and administrative tools. Start your fitness journey with us!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/register">
                <UserPlus className="w-4 h-4 mr-2" />
                New Member Registration
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/scan">
                <ScanLine className="w-4 h-4 mr-2" />
                Check Membership
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/admin">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Admin Login
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">Complete Gym Management</h2>
            <p className="text-muted-foreground">
              Everything you need to manage your gym efficiently
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card variant="glass">
              <CardContent className="p-6 text-center">
                <Dumbbell className="w-10 h-10 mx-auto text-primary mb-3" />
                <h3 className="text-lg font-semibold mb-1">Gym Training</h3>
                <p className="text-sm text-muted-foreground">
                  Access to all gym equipment and facilities.
                </p>
              </CardContent>
            </Card>
            <Card variant="glass">
              <CardContent className="p-6 text-center">
                <UserPlus className="w-10 h-10 mx-auto text-primary mb-3" />
                <h3 className="text-lg font-semibold mb-1">Member Registration</h3>
                <p className="text-sm text-muted-foreground">
                  Quick onboarding with photo capture and digital terms.
                </p>
              </CardContent>
            </Card>
            <Card variant="glass">
              <CardContent className="p-6 text-center">
                <ScanLine className="w-10 h-10 mx-auto text-primary mb-3" />
                <h3 className="text-lg font-semibold mb-1">QR Check-In</h3>
                <p className="text-sm text-muted-foreground">
                  Members scan a code to view their membership instantly.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="max-w-5xl mx-auto mt-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Member Reviews</p>
              <h2 className="text-3xl font-bold mt-2">Trusted feedback from our members</h2>
              <p className="text-muted-foreground max-w-2xl mt-3">
                Real member reviews help new visitors feel confident about training with US Gymnasium.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Average rating</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1">{renderStars(Math.round(averageRating || 0))}</div>
                <div className="text-right">
                  <p className="text-4xl font-semibold">{averageRating ? averageRating.toFixed(1) : '4.8'}</p>
                  <p className="text-sm text-muted-foreground">
                    {reviews.length} review{reviews.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {reviews.length > 0 ? (
              reviews.slice(0, 3).map((review) => (
                <Card key={review.id} variant="glass">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {review.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{review.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-7">{review.feedback}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              [1, 2, 3].map((item) => (
                <Card key={item} variant="glass" className="border-dashed border-border">
                  <CardContent className="space-y-4 p-6">
                    <div className="h-3 w-20 rounded-full bg-muted/40" />
                    <div className="h-4 w-32 rounded-full bg-muted/40" />
                    <div className="h-24 rounded-2xl bg-muted/40" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
