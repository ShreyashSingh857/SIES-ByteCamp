import React from "react";
import logoSrc from "../assets/logo.png";

const Logo = ({ className }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logoSrc} alt="Logo" className="w-8 h-8" />
      <span className="font-bold text-lg">AppName</span>
    </div>
  )
}

export default Logo