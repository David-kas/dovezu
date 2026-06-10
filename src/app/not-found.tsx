import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground mt-2">Страница не найдена</p>
      <Button asChild className="mt-6">
        <Link href="/login">На главную</Link>
      </Button>
    </div>
  );
}
