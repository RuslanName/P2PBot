import { useState } from 'react';
import type { CreateWarrantHolderFormProps } from '../../types';

const CreateWarrantHolderForm: React.FC<CreateWarrantHolderFormProps> = ({ onSubmit, setError }) => {
    const [newHolderInput, setNewHolderInput] = useState('');

    const handleNewHolderChange = (value: string) => {
        setNewHolderInput(value);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHolderInput) {
            setError('Требуется имя пользователя или Chat ID');
            return;
        }
        onSubmit(newHolderInput);
        setNewHolderInput('');
    };

    return (
        <div className="mb-4">
            <h3 className="text-lg font-semibold">Добавление ордеродержателя</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
                <input
                    type="text"
                    value={newHolderInput}
                    onChange={(e) => handleNewHolderChange(e.target.value)}
                    placeholder="Введите имя пользователя или Chat ID..."
                    className="w-full p-2 border rounded"
                />
                <button
                    type="submit"
                    className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                    Добавить
                </button>
            </form>
        </div>
    );
};

export default CreateWarrantHolderForm;