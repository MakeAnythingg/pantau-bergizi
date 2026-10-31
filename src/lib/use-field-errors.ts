"use client";

import { type SyntheticEvent, useRef, useState } from "react";

type Control = HTMLInputElement | HTMLTextAreaElement;

function isControl(target: EventTarget): target is Control {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function message(el: Control): string {
  const v = el.validity;

  if (v.valueMissing) return "Wajib diisi.";

  if (v.typeMismatch && el.type === "email") return "Masukkan alamat email yang benar.";

  if (v.badInput) return "Isi dengan angka.";

  if (v.rangeUnderflow && el instanceof HTMLInputElement) return `Minimal ${el.min}.`;

  if (v.rangeOverflow && el instanceof HTMLInputElement) return `Maksimal ${el.max}.`;

  return "Periksa isian ini.";
}

/** The message for each input name; missing once the field is fixed. */
type FieldErrors = { [name: string]: string | undefined };

/**
 * Keeps the browser's own checks (`required`, `type="email"`, `min`/`max`) but replaces its unstyled English bubble
 * with Indonesian messages, keyed by input name, for `FieldError`. Spread `formProps` on the `<form>`.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const focusedThisSubmit = useRef(false);

  return {
    errors,
    formProps: {
      onInvalidCapture(event: SyntheticEvent<HTMLFormElement>) {
        const el = event.target;

        if (!isControl(el)) return;
        event.preventDefault();
        setErrors((prev) => ({ ...prev, [el.name]: message(el) }));

        // Every invalid field fires its own event during one submit; focus only the first.
        if (!focusedThisSubmit.current) {
          focusedThisSubmit.current = true;
          el.focus();
          setTimeout(() => {
            focusedThisSubmit.current = false;
          });
        }
      },
      onInputCapture(event: SyntheticEvent<HTMLFormElement>) {
        const el = event.target;

        if (isControl(el)) setErrors((prev) => ({ ...prev, [el.name]: undefined }));
      },
    },
  };
}
