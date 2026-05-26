import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface Props {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}

const TONE_CLASS = {
  default: "btn",
  primary: "btn-primary",
  danger:  "btn-danger",
};

export default function ActionButton({ onClick, icon, label, busy, disabled, tone = "default" }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={busy || disabled}
      className={`${TONE_CLASS[tone]} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </motion.button>
  );
}
