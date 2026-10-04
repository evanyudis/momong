// ponytail: shadcn's cn without clsx/tailwind-merge; there is no Tailwind here, so no utility conflicts to merge.
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
