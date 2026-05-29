import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">Pagina no encontrada</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
