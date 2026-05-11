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
}

const defaultSettings: Settings = {
  default_user_email: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_from_name: "Task Reminder",
  reminder_days_before: "2",
};

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data.settings }));
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
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
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure email reminders and SMTP settings.
          </p>
        </div>

        <section className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Mail className="w-4 h-4 text-primary" />
            Default User
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="default_email">Default Reminder Email</Label>
            <Input
              id="default_email"
              type="email"
              placeholder="you@example.com"
              value={settings.default_user_email}
              onChange={set("default_user_email")}
            />
            <p className="text-xs text-muted-foreground">Pre-filled when creating new tasks.</p>
          </div>
        </section>

        <section className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Bell className="w-4 h-4 text-primary" />
            Reminder Settings
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="days_before">Days Before Due Date to Remind</Label>
            <Input
              id="days_before"
              type="number"
              min={1}
              max={30}
              value={settings.reminder_days_before}
              onChange={set("reminder_days_before")}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Early reminder N days before. Also sends on due date + daily when overdue.
            </p>
          </div>
        </section>

        <section className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Server className="w-4 h-4 text-primary" />
            SMTP Configuration
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input id="smtp_host" placeholder="smtp.gmail.com" value={settings.smtp_host} onChange={set("smtp_host")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input id="smtp_port" type="number" placeholder="587" value={settings.smtp_port} onChange={set("smtp_port")} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="smtp_from_name">From Name</Label>
              <Input id="smtp_from_name" placeholder="Task Reminder" value={settings.smtp_from_name} onChange={set("smtp_from_name")} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input id="smtp_user" placeholder="you@gmail.com" value={settings.smtp_user} onChange={set("smtp_user")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="smtp_pass">SMTP Password</Label>
                <Input id="smtp_pass" type="password" placeholder="••••••••" value={settings.smtp_pass} onChange={set("smtp_pass")} />
                <p className="text-xs text-muted-foreground">Leave blank to keep existing.</p>
              </div>
            </div>
          </div>
        </section>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </AppShell>
  );
}