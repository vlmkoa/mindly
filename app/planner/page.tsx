import { MonthPlanner } from "@/components/MonthPlanner";

export const metadata = {
  title: "Planner — mindly",
};

export default function PlannerPage() {
  return (
    <>
      <header>
        <div className="title">Planner</div>
        <div className="subtitle">The days ahead, one day at a time.</div>
      </header>

      <div className="page-body">
        <MonthPlanner />
      </div>
    </>
  );
}
