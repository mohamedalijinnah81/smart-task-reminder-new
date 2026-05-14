// components/SettingsForm.tsx
"use client";

import { useEffect, useState } from "react";
import AppShell from "./AppShelll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Bell, Server } from "lucide-react";

interface Settings {
  default_user_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  reminder_days_before: string;
  reminder_time: string;
}

const defaults: Settings = {
  default_user_email: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_from_name: "TaskChaser",
  reminder_days_before: "2",
  reminder_time: "09:00",
};

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings((prev) => ({ ...prev, ...d.settings })))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((prev) => ({ ...prev, [key]: e.target.value }));

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your email and reminder preferences.</p>
        </div>

        {/* Default user */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
            <Mail className="w-4 h-4 text-blue-600" />
            Default User Email
          </div>
          <div className="grid gap-1.5">
            <Label className="text-gray-600 text-sm">Email address for all task reminders</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={settings.default_user_email}
              onChange={set("default_user_email")}
              className="border-gray-300"
            />
            <p className="text-xs text-gray-400">
              This is used automatically when creating tasks via AI — no need to enter it per task.
            </p>
          </div>
        </section>

        {/* Reminder settings */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
            <Bell className="w-4 h-4 text-blue-600" />
            Reminder Settings
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-gray-600 text-sm">Days before due date (early reminder)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={settings.reminder_days_before}
                onChange={set("reminder_days_before")}
                className="border-gray-300 w-24"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-gray-600 text-sm">Daily reminder time (UTC)</Label>
              <Input
                type="time"
                value={settings.reminder_time}
                onChange={set("reminder_time")}
                className="border-gray-300 w-32"
              />
              <p className="text-xs text-gray-400">
                Reminders are sent: N days before → on due date → daily until done.
              </p>
            </div>
          </div>
        </section>

        {/* SMTP */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
            <Server className="w-4 h-4 text-blue-600" />
            SMTP Configuration
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-gray-600 text-sm">SMTP Host</Label>
                <Input placeholder="smtp.gmail.com" value={settings.smtp_host} onChange={set("smtp_host")} className="border-gray-300" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-gray-600 text-sm">SMTP Port</Label>
                <Input type="number" placeholder="587" value={settings.smtp_port} onChange={set("smtp_port")} className="border-gray-300" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-gray-600 text-sm">From Name</Label>
              <Input placeholder="TaskChaser" value={settings.smtp_from_name} onChange={set("smtp_from_name")} className="border-gray-300" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-gray-600 text-sm">SMTP Username</Label>
                <Input placeholder="you@gmail.com" value={settings.smtp_user} onChange={set("smtp_user")} className="border-gray-300" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-gray-600 text-sm">SMTP Password</Label>
                <Input type="password" placeholder="••••••••" value={settings.smtp_pass} onChange={set("smtp_pass")} className="border-gray-300" />
                <p className="text-xs text-gray-400">Leave blank to keep existing password.</p>
              </div>
            </div>
          </div>
        </section>

        <Button
          onClick={save}
          disabled={saving}
          className="text-white"
          style={{ background: "#0052cc" }}
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </AppShell>
  );
}