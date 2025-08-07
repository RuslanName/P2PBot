import { useState, useRef, useEffect } from 'react';
import type { TooltipProps } from "../types";

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const updateTooltipPosition = () => {
        if (triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let top = triggerRect.bottom + 8;
            let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

            if (left + tooltipRect.width > viewportWidth - 10) {
                left = viewportWidth - tooltipRect.width - 10;
            }

            if (left < 10) {
                left = 10;
            }

            if (top + tooltipRect.height > viewportHeight - 10) {
                top = triggerRect.top - tooltipRect.height - 8;
            }
            if (top < 10) {
                top = 10;
            }

            setPosition({ top, left });
        }
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 100);
    };

    useEffect(() => {
        if (isVisible) {
            updateTooltipPosition();
            window.addEventListener('resize', updateTooltipPosition);
            window.addEventListener('scroll', updateTooltipPosition);
        }
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            window.removeEventListener('resize', updateTooltipPosition);
            window.removeEventListener('scroll', updateTooltipPosition);
        };
    }, [isVisible]);

    return (
        <div className="relative inline-block">
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </div>
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-10 p-2 text-sm text-white bg-gray-800 rounded shadow-lg whitespace-pre-line"
                    style={{ top: `${position.top}px`, left: `${position.left}px` }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {content}
                </div>
            )}
        </div>
    );
};