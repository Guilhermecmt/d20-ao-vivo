export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0c1023", color: "#f6dab2", fontFamily: "sans-serif", textAlign: "center", padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Dados de RPG ao Vivo</h1>
        <p style={{ color: "#aaa8ba" }}>Servidor de salas e rolagens ativo.</p>
        <a href="https://guilhermecmt.github.io/d20-ao-vivo/" style={{ color: "#e5b978" }}>Abrir o jogo</a>
      </div>
    </main>
  );
}
