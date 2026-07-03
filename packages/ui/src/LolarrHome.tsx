import type { ComponentType, ReactNode } from "react";
import iconsHref from "./assets/icons.svg";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";

export type InteractiveControlProps = {
  href?: string;
  onPress?: () => void;
  className?: string;
  children: ReactNode;
};

export type InteractiveControlComponent =
  ComponentType<InteractiveControlProps>;

export type ShellProps = {
  children: ReactNode;
};

type LolarrHomeProps = {
  count: number;
  onIncrement: () => void;
  Action: InteractiveControlComponent;
  Link: InteractiveControlComponent;
  Shell?: ComponentType<ShellProps>;
};

function DefaultShell({ children }: ShellProps) {
  return <>{children}</>;
}

export function LolarrHome({
  count,
  onIncrement,
  Action,
  Link,
  Shell = DefaultShell,
}: LolarrHomeProps) {
  return (
    <Shell>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <Action className="counter" onPress={onIncrement}>
          Count is {count}
        </Action>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href={`${iconsHref}#documentation-icon`}></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <Link className="focusable" href="https://vite.dev/">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </Link>
            </li>
            <li>
              <Link className="focusable" href="https://react.dev/">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </Link>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href={`${iconsHref}#social-icon`}></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <Link className="focusable" href="https://github.com/vitejs/vite">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href={`${iconsHref}#github-icon`}></use>
                </svg>
                GitHub
              </Link>
            </li>
            <li>
              <Link className="focusable" href="https://chat.vite.dev/">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href={`${iconsHref}#discord-icon`}></use>
                </svg>
                Discord
              </Link>
            </li>
            <li>
              <Link className="focusable" href="https://x.com/vite_js">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href={`${iconsHref}#x-icon`}></use>
                </svg>
                X.com
              </Link>
            </li>
            <li>
              <Link
                className="focusable"
                href="https://bsky.app/profile/vite.dev"
              >
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href={`${iconsHref}#bluesky-icon`}></use>
                </svg>
                Bluesky
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </Shell>
  );
}
