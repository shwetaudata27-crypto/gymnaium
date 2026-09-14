import { GymHeader } from '@/components/gym/GymHeader';
import { AdminRoute } from '@/components/AdminRoute';

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-8">
        <AdminRoute />
      </main>
    </div>
  );
};

export default Admin;
