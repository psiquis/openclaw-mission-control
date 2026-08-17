"use client";

import { useEffect, useState } from "react";
import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface Task {
  id: string;
  name: string;
  schedule: string;
  description: string;
  nextRun: string;
}

export function WeeklyCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getTasksForDayAndHour = (day: Date, hour: number) => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.nextRun);
      return isSameDay(taskDate, day) && taskDate.getHours() === hour;
    });
  };

  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        <h2 className="text-lg font-medium text-white">
          {format(currentWeekStart, "MMMM yyyy")}
        </h2>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Calendar className="w-4 h-4" />
          <span>{tasks.length} scheduled tasks</span>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-8 border-b border-gray-800">
        <div className="p-3 text-center text-sm text-gray-500 border-r border-gray-800">
          Time
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-3 text-center border-r border-gray-800 last:border-r-0 ${
              isSameDay(day, new Date())
                ? "bg-emerald-500/10"
                : ""
            }`}
          >
            <div className="text-xs text-gray-500">
              {format(day, "EEE")}
            </div>
            <div
              className={`text-lg font-medium ${
                isSameDay(day, new Date()) ? "text-emerald-400" : "text-white"
              }`}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time Grid - Show 6am to 10pm */}
      <div className="max-h-[600px] overflow-y-auto">
        {hours.filter(h => h >= 6 && h <= 22).map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-gray-800 last:border-b-0">
            <div className="p-2 text-xs text-gray-500 text-right pr-3 border-r border-gray-800">
              {format(new Date().setHours(hour, 0), "HH:mm")}
            </div>
            {days.map((day) => {
              const dayTasks = getTasksForDayAndHour(day, hour);
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={`p-1 min-h-[48px] border-r border-gray-800 last:border-r-0 ${
                    isSameDay(day, new Date()) ? "bg-emerald-500/5" : ""
                  }`}
                >
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-emerald-600/20 border-l-2 border-emerald-500 px-2 py-1 rounded text-xs mb-1"
                    >
                      <div className="font-medium text-emerald-400 truncate">
                        {task.name}
                      </div>
                      <div className="text-gray-500 truncate">
                        {task.schedule}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
