/* eslint-disable @next/next/no-img-element -- the EdgeOne/Vite build serves public assets directly */
import { filmProjects, filmUrl } from "../src/films";

export default function SiteHome() {
  return (
    <main className="cosmos-home">
      <header className="cosmos-nav">
        <a className="cosmos-mark" href="./" aria-label="Cosmos Film 42 首页">
          <span>COSMOS</span>
          <i>FILM 42</i>
        </a>
        <p>INDEPENDENT FILM / INTERACTIVE ARCHIVE</p>
      </header>

      <section className="cosmos-hero" aria-labelledby="cosmos-title">
        <p className="cosmos-kicker">COSMOS FILM 42 PRESENTS</p>
        <h1 id="cosmos-title">
          电影散场以后，
          <br />
          <em>故事还在发生。</em>
        </h1>
        <div className="cosmos-hero-foot">
          <p>
            这里收录我们的电影，也收录电影之外的入口。
            <br />
            进入一部作品，拍一张照片，带走一张属于你的海报。
          </p>
          <span>{String(filmProjects.length).padStart(2, "0")} FILM ONLINE</span>
        </div>
      </section>

      <section className="film-library" aria-labelledby="films-heading">
        <div className="library-heading">
          <p className="cosmos-kicker">NOW SHOWING / ARCHIVE</p>
          <h2 id="films-heading">电影项目</h2>
        </div>

        <div className="film-grid">
          {filmProjects.map((film) => (
            <article className="film-card" key={film.slug}>
              <a className="film-poster-link" href={filmUrl(film.slug)}>
                <img
                  src={film.poster}
                  width={795}
                  height={1194}
                  loading="eager"
                  decoding="async"
                  alt={`${film.title} 电影海报`}
                />
                <span className="film-enter">进入项目 ↗</span>
              </a>
              <div className="film-card-copy">
                <div className="film-number">FILM / {film.number}</div>
                <div>
                  <h3>{film.title}</h3>
                  <p className="film-cn-title">{film.chineseTitle}</p>
                </div>
                <p className="film-description">{film.description}</p>
                <div className="film-card-meta">
                  <span>{film.year}</span>
                  <span>{film.experience}</span>
                  <span className="film-live"><i /> OPEN</span>
                </div>
              </div>
            </article>
          ))}

          <article className="film-card film-card-next" aria-label="下一部电影即将加入">
            <div className="next-film-frame">
              <span>NEXT FILM</span>
              <strong>02</strong>
              <p>COMING SOON</p>
            </div>
          </article>
        </div>
      </section>

      <footer className="cosmos-footer">
        <span>COSMOS FILM 42</span>
        <p>FILMS / EXPERIENCES / ARCHIVE</p>
        <p>© 2026</p>
      </footer>
    </main>
  );
}
