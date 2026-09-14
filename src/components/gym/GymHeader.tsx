import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Menu } from "lucide-react";
import logoImage from "@/assets/us-gymnasium-logo.png";

interface GymHeaderProps {
  showNav?: boolean;
  showBackButton?: boolean;
}

const navItems = [
  { to: "/", label: "Home" },
  { to: "/register", label: "Register" },
  { to: "/scan", label: "Scan" },
  { to: "/admin", label: "Admin" },
  { to: "/settings", label: "Settings" },
];

export function GymHeader({ showNav = true, showBackButton = true }: GymHeaderProps) {
  const navigate = useNavigate();
  const canGoBack = useMemo(
    () => typeof window !== 'undefined' && window.history.length > 1,
    [],
  );

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && canGoBack && (
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back">
              <ArrowLeft />
            </Button>
          )}

          <Link to="/" className="flex items-center gap-3 group">
            <img 
              src={logoImage} 
              alt="US Gymnasium Logo" 
              className="w-12 h-12 object-contain"
            />
            <div className="leading-tight">
              <p className="text-xl font-bold gradient-text">US Gymnasium</p>
              <p className="text-xs text-muted-foreground">Ultimate Strength</p>
            </div>
          </Link>
        </div>

        {showNav && (
          <>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4" aria-label="Primary">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile nav */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-2" aria-label="Mobile primary">
                    {navItems.map((item) => (
                      <Button key={item.to} variant="ghost" className="justify-start" asChild>
                        <Link to={item.to}>{item.label}</Link>
                      </Button>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
