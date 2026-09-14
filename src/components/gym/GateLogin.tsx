import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, User, Dumbbell, Eye, EyeOff } from 'lucide-react';

const GATE_KEY = 'gym_gate_unlocked';

// Hard-coded gate credentials (frontend-only).
const GATE_USER = 'shubham';
const GATE_PASS = 'gym@1521';

export function isGateUnlocked(): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function lockGate() {
  try {
    sessionStorage.removeItem(GATE_KEY);
  } catch { /* no-op */ }
}

interface GateLoginProps {
  onUnlock: () => void;
}

export function GateLogin({ onUnlock }: GateLoginProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (username.trim() === GATE_USER && password === GATE_PASS) {
      try {
        sessionStorage.setItem(GATE_KEY, 'true');
      } catch { /* no-op */ }
      toast({ title: 'Welcome', description: 'Access granted.' });
      onUnlock();
    } else {
      toast({
        title: 'Access Denied',
        description: 'Invalid username or password.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card variant="glass" className="w-full max-w-md animate-slide-up">
        <CardHeader className="text-center">
          <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary to-gym-gold glow mb-4">
            <Dumbbell className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl gradient-text">US Gymnasium</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="gate-username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="gate-username"
                  type="text"
                  placeholder="gymnasium"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gate-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="gate-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}