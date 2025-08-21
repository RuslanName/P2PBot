import { useEffect, useState, useRef } from 'react';
import type { TableWrapperProps } from "../types";

const TableWrapper = <T extends { id: number }>({
                                                    items,
                                                    fetchItems,
                                                    renderTableBody,
                                                    loading,
                                                    error,
                                                    hasMore,
                                                    searchParams = {},
                                                }: TableWrapperProps<T>) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [, setPage] = useState(1);
    const observer = useRef<IntersectionObserver | null>(null);
    const lastItemRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setPage(1);
        fetchItems(1, false, searchParams);
    }, [searchParams]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    setPage((prev) => {
                        const nextPage = prev + 1;
                        fetchItems(nextPage, true, searchParams);
                        return nextPage;
                    });
                }
            },
            { threshold: 0.1 }
        );

        if (lastItemRef.current) {
            observer.current.observe(lastItemRef.current);
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [hasMore, loading, searchParams, fetchItems]);

    return (
        <div className="table-responsive">
            {isMobile ? (
                <div className="card-stack">
                    {items.length === 0 && !loading ? (
                        <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
                    ) : (
                        renderTableBody(items, true)
                    )}
                </div>
            ) : (
                <>
                    {items.length === 0 && !loading ? (
                        <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
                    ) : (
                        renderTableBody(items, false)
                    )}
                    {hasMore && (
                        <div ref={lastItemRef} className="h-10" />
                    )}
                </>
            )}
            {loading && <p className="text-center">Загрузка...</p>}
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
    );
};

export default TableWrapper;