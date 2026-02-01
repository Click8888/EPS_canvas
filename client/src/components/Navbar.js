import './navbar.css'
export default function Navbar() {
  return (
    <nav className="navbar navbar-dark bg-dark">
      <div className="container-fluid bg-dark">
        <a className="navbar-brand fw-bold" href="/">EPS</a>

        {/* Ссылка на админ-панель справа в виде кнопки */}
        <div className="d-flex">
          <a className="btn btn-outline-light btn-sm" href="/admin">
            <i className="bi bi-gear-fill me-1"></i>
            Админ-панель
          </a>
        </div>
      </div>
    </nav>
  );
}