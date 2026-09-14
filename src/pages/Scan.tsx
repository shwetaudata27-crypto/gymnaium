import { GymHeader } from '@/components/gym/GymHeader';
import { ClientScanner } from '@/components/gym/ClientScanner';

const Scan = () => {
  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-8">
        <ClientScanner />
      </main>
    </div>
  );
};

export default Scan;
