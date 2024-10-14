import React from "react";

import { cn } from "@/utils";

const ToggleSwitch = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string}) => {
  const { type, value, className, label, ...restProps } = props;
  return (
    <label className="flex flex-col items-center cursor-pointer">
      {!!label && <span className="text-sm font-medium text-gray-900 dark:text-gray-300">{label}</span>}
      <input type={type || 'checkbox'} value={value || ''} className={cn("sr-only peer", className)} {...restProps} />
      <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
  </label>
  )
}

export default ToggleSwitch