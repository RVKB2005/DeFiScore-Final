import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/hooks/useWallet";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WalletConnectModal } from "@/components/modals/WalletConnectModal";
import { CreditVerificationModal } from "@/components/modals/CreditVerificationModal";
import Dashboard from "./pages/Dashboard";
import AssetDetail from "./pages/AssetDetail";
import Supply from "./pages/Supply";
import Borrow from "./pages/Borrow";
import BorrowHistory from "./pages/BorrowHistory";
import PreviousRequests from "./pages/PreviousRequests";
import LoanOffers from "./pages/LoanOffers";
import CreditScore from "./pages/CreditScore";
import UserDashboard from "./pages/UserDashboard";
import ManageSupply from "./pages/ManageSupply";
import FAQ from "./pages/FAQ";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <DashboardLayout onWalletClick={() => setWalletModalOpen(true)}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/asset/:symbol" element={<AssetDetail />} />
                <Route path="/supply" element={<Supply />} />
                <Route path="/borrow" element={<Borrow />} />
                <Route path="/borrow/previous-requests" element={<PreviousRequests />} />
                <Route path="/borrow/history" element={<BorrowHistory />} />
                <Route path="/borrow/offer" element={<LoanOffers />} />
                <Route path="/score" element={<CreditScore onVerify={() => setVerificationOpen(true)} />} />
                <Route path="/user" element={<UserDashboard />} />
                <Route path="/manage-supply" element={<ManageSupply />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DashboardLayout>

            {/* Modals */}
            <WalletConnectModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
            <CreditVerificationModal isOpen={verificationOpen} onClose={() => setVerificationOpen(false)} onSuccess={() => {}} />
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
};

export default App;
