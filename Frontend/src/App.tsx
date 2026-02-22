import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/hooks/useWallet";
import { MarketDataProvider } from "@/contexts/MarketDataContext";
import { UserDataProvider } from "@/contexts/UserDataContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WalletConnectModal } from "@/components/modals/WalletConnectModal";
import Dashboard from "./pages/Dashboard";
import AssetDetail from "./pages/AssetDetail";
import Supply from "./pages/SupplyNew";
import Borrow from "./pages/Borrow";
import BorrowHistory from "./pages/BorrowHistory";
import PreviousRequests from "./pages/PreviousRequests";
import LoanOffers from "./pages/LoanOffers";
import LoansPage from "./pages/LoansPage";
import CreditScore from "./pages/CreditScore";
import UserDashboard from "./pages/UserDashboard";
import ManageSupply from "./pages/ManageSupply";
import FAQ from "./pages/FAQ";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <MarketDataProvider>
          <UserDataProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <DashboardLayout onWalletClick={() => setWalletModalOpen(true)}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/asset/:symbol" element={<AssetDetail />} />
                    <Route path="/supply" element={<Supply onWalletClick={() => setWalletModalOpen(true)} />} />
                    <Route path="/borrow" element={<Borrow onWalletClick={() => setWalletModalOpen(true)} />} />
                    <Route path="/borrow/previous-requests" element={<PreviousRequests />} />
                    <Route path="/borrow/history" element={<BorrowHistory />} />
                    <Route path="/borrow/offer" element={<LoanOffers />} />
                    <Route path="/loans" element={<LoansPage onWalletClick={() => setWalletModalOpen(true)} />} />
                    <Route path="/score" element={<CreditScore />} />
                    <Route path="/user" element={<UserDashboard onWalletClick={() => setWalletModalOpen(true)} />} />
                    <Route path="/manage-supply" element={<ManageSupply />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DashboardLayout>

                {/* Modals */}
                <WalletConnectModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
              </BrowserRouter>
            </TooltipProvider>
          </UserDataProvider>
        </MarketDataProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
};

export default App;
