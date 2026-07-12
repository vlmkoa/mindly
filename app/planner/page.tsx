import { MonthPlanner } from "@/components/MonthPlanner";

export const metadata = {
  title: "Planner — ________",
};

export default function PlannerPage() {
  return (
    <>
      <header>
        <div className="title">Planner</div>
        <div className="subtitle">The months ahead, one square at a time.</div>
      </header>

      <div className="page-body">
        <MonthPlanner />
      </div>
    </>
  );
}
