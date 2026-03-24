import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Results = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="glass-surface rounded-2xl p-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-3">Session summary</p>
          <h1 className="font-heading text-4xl font-bold text-foreground">Use the live dashboard for real progress.</h1>
          <p className="text-muted-foreground mt-4">
            The app now stores attempts directly in PostgreSQL and computes progression, streaks and OTP stats from the saved history. This placeholder page remains as a lightweight transition screen.
          </p>
          <div className="flex justify-center gap-3 mt-8">
            <Link to="/dashboard"><Button variant="gold">Open dashboard</Button></Link>
            <Link to="/training"><Button variant="outline">Continue training</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
