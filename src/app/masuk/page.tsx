import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_PASSWORD, MODERATOR_EMAIL, SEED_SPPG } from "@/db/seed-data";
import { LoginForm } from "./login-form";

const demoAccounts = [
  { email: MODERATOR_EMAIL, role: "Moderator" },
  ...SEED_SPPG.flatMap((s) => (s.managerEmail ? [{ email: s.managerEmail, role: `Pengelola ${s.name}` }] : [])),
];

export default function MasukPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Masuk petugas</CardTitle>
          <CardDescription>Untuk moderator Pantau Bergizi dan pengelola SPPG.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <section className="rounded-lg border p-4 text-sm">
        <h2 className="font-medium">Akun demo</h2>
        <p className="text-muted-foreground">
          Kata sandi semua akun: <code>{DEMO_PASSWORD}</code>
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {demoAccounts.map((a) => (
            <li key={a.email}>
              <code>{a.email}</code> · {a.role}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
