import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/context";
import { useLanguage } from "../i18n/useLanguage";

const TestConsumer = ({ keyToTranslate }: { keyToTranslate: string }) => {
  const { t, lang } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="translation">{t(keyToTranslate)}</span>
    </div>
  );
};

const LangSwitcher = () => {
  const { setLang } = useLanguage();
  return <button onClick={() => setLang("en")}>Switch to en</button>;
};

describe("LanguageProvider", () => {
  it("renders children and provides default 'fr' language", () => {
    render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(TestConsumer, { keyToTranslate: "nav.home" }),
      ),
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("fr");
  });

  it("translates a known key in French", () => {
    render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(TestConsumer, { keyToTranslate: "nav.home" }),
      ),
    );
    expect(screen.getByTestId("translation").textContent).not.toBe("nav.home");
  });

  it("returns the key itself for unknown translation keys", () => {
    render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(TestConsumer, { keyToTranslate: "unknown.key.xyz" }),
      ),
    );
    expect(screen.getByTestId("translation")).toHaveTextContent("unknown.key.xyz");
  });

  it("keeps lang as fr when setLang is called with 'en'", () => {
    render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(LangSwitcher),
        React.createElement(TestConsumer, { keyToTranslate: "nav.home" }),
      ),
    );
    fireEvent.click(screen.getByText("Switch to en"));
    expect(screen.getByTestId("lang")).toHaveTextContent("fr");
  });
});

describe("useLanguage", () => {
  it("throws an error when used outside a LanguageProvider", () => {
    const ThrowingComponent = () => {
      useLanguage();
      return null;
    };
    expect(() => render(React.createElement(ThrowingComponent))).toThrow(
      "useLanguage must be used within LanguageProvider",
    );
  });
});
