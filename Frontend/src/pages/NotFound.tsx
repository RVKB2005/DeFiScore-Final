import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">404</h1>
          <p className="text-xl text-muted-foreground">Page not found</p>
        </div>
        <Link to="/">
          <Button variant="glow" className="gap-2">
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
