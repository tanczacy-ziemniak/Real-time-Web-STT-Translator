import type { LanguageOption } from "../types";

interface LanguageSelectorProps {
  languages: LanguageOption[];
  sourceLanguage: string;
  targetLanguage: string;
  onSourceLanguageChange: (language: string) => void;
  onTargetLanguageChange: (language: string) => void;
}

export function LanguageSelector({
  languages,
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange
}: LanguageSelectorProps) {
  return (
    <div className="language-selector" aria-label="Language selection">
      <label className="field">
        <span>STT Source</span>
        <select value={sourceLanguage} onChange={(event) => onSourceLanguageChange(event.target.value)}>
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>

      <div className="direction-mark" aria-hidden="true">
        to
      </div>

      <label className="field">
        <span>Translation Target</span>
        <select value={targetLanguage} onChange={(event) => onTargetLanguageChange(event.target.value)}>
          {languages.map((language) => (
            <option key={language.englishName} value={language.englishName}>
              {language.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
