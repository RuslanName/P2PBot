import { useState, type ChangeEvent } from 'react';
import { debounce } from 'lodash';
import type { SearchFilterParams, SearchFilterProps } from '../types';

const SearchFilter: React.FC<SearchFilterProps> = ({ filterFields, onSearch }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});

    const debouncedSearch = debounce((params: SearchFilterParams) => {
        onSearch(params);
    }, 300);

    const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        debouncedSearch({ search: e.target.value, ...filterValues });
    };

    const handleFilterChange = (field: string, value: string) => {
        setFilterValues((prev) => ({ ...prev, [field]: value }));
        debouncedSearch({ search: searchQuery, ...filterValues, [field]: value });
    };

    return (
        <div className="mb-4">
            <div className="mb-4">
                <h3 className="text-lg font-semibold">Поиск</h3>
                <input
                    type="text"
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full p-2 border rounded"
                />
            </div>
            <div>
                <h3 className="text-lg font-semibold">Фильтры</h3>
                <div className="flex flex-wrap gap-4">
                    {filterFields.map((field) => (
                        <div key={field.field} className="flex-1 min-w-[200px]">
                            <label className="block text-gray-700">{field.label}</label>
                            {field.type === 'select' && field.options ? (
                                <select
                                    value={filterValues[field.field] || ''}
                                    onChange={(e) => handleFilterChange(field.field, e.target.value)}
                                    className="w-full p-2 border rounded"
                                >
                                    {field.options.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            ) : field.type === 'dateRange' ? (
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={filterValues['createdAtStart'] || ''}
                                        onChange={(e) =>
                                            handleFilterChange('createdAtStart', e.target.value)
                                        }
                                        className="w-full p-2 border rounded"
                                    />
                                    <input
                                        type="date"
                                        value={filterValues['createdAtEnd'] || ''}
                                        onChange={(e) =>
                                            handleFilterChange('createdAtEnd', e.target.value)
                                        }
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SearchFilter;