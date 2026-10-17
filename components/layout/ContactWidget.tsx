"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageSquare, Camera, Phone, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Expandable contact widget (Denri-style).
 *
 * Collapsed state: a single floating circular button, bottom-right, 56px,
 * showing a chat/contact icon. Uses bg-primary.
 *
 * Click expands the widget upward into a stack of 4 options, each a white card
 * with an icon (left), label (bold), subtitle (muted, smaller).
 *
 * Click an option → opens the corresponding link in a new tab.
 * Click anywhere outside → collapses.
 * Escape key → collapses.
 *
 * Options (in this exact order):
 *
 * 1. WhatsApp us — "Fastest reply" — wa.me link
 * 2. Instagram — "@pedigreeleather" — Instagram profile link
 * 3. Call us — "+254 791 004 004" — tel: link
 * 4. Email us — "hello@pedigree.co.ke" — mailto: link
 *
 * Reads phone/WhatsApp/email from getShopConfig() (via props from server component).
 * Hidden on /admin routes.
 * Mobile: 56px button, tap target stays large, options appear with a smooth
 * upward stagger animation (Framer Motion).
 * Respects prefers-reduced-motion: if enabled, skip the stagger, just show/hide.
 */

interface ContactOption {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  external: boolean;
}

interface ContactWidgetProps {
  whatsappNumber: string;
  whatsappUrl: string;
  instagramHandle: string;
  instagramUrl: string;
  phoneNumber: string;
  phoneDisplay: string;
  email: string;
}

const STAGGER_DELAY = 0.06;
const ENTER_SPRING = { type: "spring", duration: 0.35, bounce: 0 } as const;

export function ContactWidget({
  whatsappNumber,
  whatsappUrl,
  instagramHandle,
  instagramUrl,
  phoneNumber,
  phoneDisplay,
  email,
}: ContactWidgetProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (pathname.startsWith("/admin")) return null;

  const options: ContactOption[] = [
    {
      id: "whatsapp",
      label: "WhatsApp us",
      subtitle: "Fastest reply",
      icon: <MessageSquare aria-hidden="true" className="size-5" strokeWidth={2} />,
      href: `https://wa.me/${whatsappNumber}`,
      external: true,
    },
    {
      id: "instagram",
      label: "Instagram",
      subtitle: instagramHandle || "@pedigreeleather",
      icon: <Camera aria-hidden="true" className="size-5" strokeWidth={2} />,
      href: instagramUrl || "https://instagram.com/pedigreeleather",
      external: true,
    },
    {
      id: "call",
      label: "Call us",
      subtitle: phoneDisplay,
      icon: <Phone aria-hidden="true" className="size-5" strokeWidth={2} />,
      href: `tel:+${phoneNumber}`,
      external: false,
    },
    {
      id: "email",
      label: "Email us",
      subtitle: email,
      icon: <Mail aria-hidden="true" className="size-5" strokeWidth={2} />,
      href: `mailto:${email}`,
      external: false,
    },
  ];

  const handleOptionClick = (option: ContactOption) => {
    if (option.external) {
      window.open(option.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = option.href;
    }
    setIsOpen(false);
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      ref={widgetRef}
      className="fixed right-5 bottom-5 z-40 sm:right-6 sm:bottom-6"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="absolute inset-0 -right-5 -bottom-5 sm:-right-6 sm:-bottom-6"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="options"
            initial={reduceMotion ? { opacity: 0, y: 20 } : { opacity: 0, y: 20 }}
            animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, y: 20 } : { opacity: 0, y: 20 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: "easeOut",
              staggerChildren: STAGGER_DELAY,
              staggerDirection: -1,
            }}
            className="absolute right-0 bottom-16 flex flex-col-reverse gap-2 pr-1"
            role="menu"
            aria-label="Contact options"
          >
            {options.map((option, index) => (
              <motion.button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                role="menuitem"
                className="group flex w-[280px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-card-lift border border-border transition-all duration-200 hover:shadow-lg hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                style={{ touchAction: "manipulation" }}
              >
                <span
                  aria-hidden="true"
                  className="flex shrink-0 size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                  {option.icon}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-foreground truncate">{option.label}</p>
                  <p className="text-xs text-muted truncate">{option.subtitle}</p>
                </div>
                <X aria-hidden="true" className="size-4 text-muted group-hover:text-foreground transition-colors" />
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={buttonRef}
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isOpen ? "Close contact options" : "Open contact options"}
        className="group flex size-14 items-center justify-center rounded-full bg-primary text-background shadow-card-lift focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, rotate: isOpen ? 45 : 0 }}
        transition={ENTER_SPRING}
        {...(reduceMotion
          ? {}
          : {
              whileHover: { scale: 1.05 },
              whileTap: { scale: 0.92 },
              whileFocus: { scale: 1.05 },
            })}
      >
        <MessageSquare aria-hidden="true" className="size-7" strokeWidth={1.75} />
        <span className="sr-only">{isOpen ? "Close contact options" : "Open contact options"}</span>
      </motion.button>
    </div>
  );
}