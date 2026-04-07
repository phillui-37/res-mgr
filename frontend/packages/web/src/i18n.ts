import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

// Translation files are served from public/locales/{lng}/translation.json.
// They are NOT bundled — users can edit them directly in the dist folder.
// The load path uses "./" so it works under both web servers and Electron's file:// origin.
i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: localStorage.getItem("i18n_lang") ?? "en",
    fallbackLng: "en",
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: "./locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
