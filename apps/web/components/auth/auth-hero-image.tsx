"use client";

import React from "react";
import Image from "next/image";
import { useAuthIllustration } from "./auth-illustration-context";

interface AuthHeroImageProps {
  fallbackSrc?: string;
  alt?: string;
}

export function AuthHeroImage({
  fallbackSrc = "/images/auth/character/login-default.jpg",
  alt = "IRIS Companion",
}: AuthHeroImageProps) {
  const { illustration } = useAuthIllustration();
  const src = illustration || fallbackSrc;

  return (
    <div className="relative hidden bg-black md:block select-none overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-contain p-2 select-none transition-opacity duration-200"
      />
    </div>
  );
}
