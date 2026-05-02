import clsx from "clsx";

type SilhouetteProps = {
  blur?: "xl" | "md" | "sm" | "none";
  className?: string;
};

const blurMap = {
  xl: "blur-xl",
  md: "blur-md",
  sm: "blur-sm",
  none: ""
} as const;

export default function Silhouette({ blur = "md", className }: SilhouetteProps) {
  return (
    <div
      className={clsx(
        "relative mx-auto h-56 w-36 overflow-hidden rounded-[2rem] border border-white/50 bg-white/50 shadow-[0_18px_40px_rgba(86,43,28,0.14)]",
        blurMap[blur],
        className
      )}
    >
      <div className="absolute left-1/2 top-8 h-16 w-16 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(210,90,64,0.26),rgba(143,52,34,0.18))]" />
      <div className="absolute bottom-0 left-1/2 h-32 w-28 -translate-x-1/2 rounded-t-[2rem] bg-[linear-gradient(180deg,rgba(210,90,64,0.22),rgba(143,52,34,0.1))]" />
    </div>
  );
}
