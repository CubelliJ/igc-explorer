import { useEffect, useState } from "react";
import { IgcExplorer } from "./IgcExplorer";
import { Migrador107 } from "./Migrador107";
import "./App.css";

type Route = "igc" | "migrador";

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (
    h === "migrador" ||
    h === "migrador-107" ||
    h === "lots" ||
    h === "optimizer"
  ) {
    return "migrador";
  }
  return "igc";
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(next: Route) {
    window.location.hash = next === "migrador" ? "#/migrador" : "#/";
    setRoute(next);
  }

  return (
    <>
      <nav className="app-nav" aria-label="Herramientas">
        <div className="app-nav-inner">
          <button
            type="button"
            className={route === "igc" ? "active" : undefined}
            onClick={() => go("igc")}
          >
            IGC Explorer
          </button>
          <button
            type="button"
            className={route === "migrador" ? "active" : undefined}
            onClick={() => go("migrador")}
          >
            Migrador 107
          </button>
        </div>
      </nav>
      {route === "igc" ? <IgcExplorer /> : <Migrador107 />}
    </>
  );
}
