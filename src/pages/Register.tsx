import { GymHeader } from '@/components/gym/GymHeader';
import { ClientRegistrationForm } from '@/components/gym/ClientRegistrationForm';

const Register = () => {
  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-8">
        <ClientRegistrationForm />
      </main>
    </div>
  );
};

export default Register;
