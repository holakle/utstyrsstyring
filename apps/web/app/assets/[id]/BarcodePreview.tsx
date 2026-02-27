"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodePreview({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      width: 2,
      height: 72,
      margin: 10,
      displayValue: true,
      fontSize: 14,
    });
  }, [value]);

  return <svg ref={svgRef} role="img" aria-label={`Strekkode ${value}`} />;
}
