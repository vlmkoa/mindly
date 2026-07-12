"""Planner tasks: list by date, create, toggle done, delete."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import PlannerTask, User
from schemas import TaskCreateIn, TaskOut, TaskPatchIn
from security import current_user

router = APIRouter(prefix="/api/planner", tags=["planner"])


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    date: str | None = None,
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Either a single ?date=YYYY-MM-DD, or an inclusive ?start=&end= range.

    The range form exists for the month-calendar planner: one query fetches
    the whole visible month. Dates are YYYY-MM-DD strings, so plain string
    comparison sorts correctly.
    """
    query = select(PlannerTask).where(PlannerTask.user_id == user.id)
    if date is not None:
        query = query.where(PlannerTask.date == date)
    elif start is not None and end is not None:
        query = query.where(PlannerTask.date >= start, PlannerTask.date <= end)
    else:
        raise HTTPException(status_code=400, detail="Provide ?date= or ?start=&end=")
    return db.scalars(query.order_by(PlannerTask.date, PlannerTask.created_at)).all()


@router.post("/tasks", response_model=TaskOut)
def create_task(body: TaskCreateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = PlannerTask(user_id=user.id, date=body.date, title=body.title.strip())
    db.add(task)
    db.commit()
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def toggle_task(task_id: str, body: TaskPatchIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = db.get(PlannerTask, task_id)
    # Ownership check — never mutate another user's rows.
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    task.done = body.done
    db.commit()
    return task


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = db.get(PlannerTask, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}
