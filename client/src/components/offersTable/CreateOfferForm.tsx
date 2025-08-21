import { useState } from 'react';
import Select from 'react-select';
import type { CreateOfferFormProps } from "../../types";

const CreateOfferForm: React.FC<CreateOfferFormProps> = ({ onSubmit }) => {
    const [newOffer, setNewOffer] = useState({
        type: 'buy',
        coin: '',
        fiatCurrency: [] as string[],
        minDealAmount: 0,
        maxDealAmount: 0,
        markupPercent: 0,
        warrantHolderPaymentDetails: [] as string[],
    });

    const fiatCurrencies = [
        { value: 'RUB', label: 'RUB' },
        { value: 'UAH', label: 'UAH' },
        { value: 'KZT', label: 'KZT' },
        { value: 'BYN', label: 'BYN' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(newOffer);
        setNewOffer({
            type: 'buy',
            coin: '',
            fiatCurrency: [],
            minDealAmount: 0,
            maxDealAmount: 0,
            markupPercent: 0,
            warrantHolderPaymentDetails: [],
        });
    };

    return (
        <div className="mb-4">
            <h3 className="text-lg font-semibold">Создание оферты</h3>
            <form onSubmit={handleSubmit} className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-700">Тип</label>
                        <select
                            value={newOffer.type}
                            onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value })}
                            className="w-full p-2 border rounded"
                        >
                            <option value="buy">Покупка</option>
                            <option value="sell">Продажа</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700">Криптовалюта</label>
                        <select
                            value={newOffer.coin}
                            onChange={(e) => setNewOffer({ ...newOffer, coin: e.target.value })}
                            className="w-full p-2 border rounded"
                        >
                            <option value="">Выберите валюту</option>
                            <option value="BTC">BTC</option>
                            <option value="LTC">LTC</option>
                            <option value="USDT">USDT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700">Фиатная валюта</label>
                        <Select
                            isMulti
                            options={fiatCurrencies}
                            value={fiatCurrencies.filter(currency => newOffer.fiatCurrency.includes(currency.value))}
                            onChange={(selected) => {
                                const selectedCurrencies = selected ? selected.map(option => option.value) : [];
                                setNewOffer({
                                    ...newOffer,
                                    fiatCurrency: selectedCurrencies,
                                    warrantHolderPaymentDetails: selectedCurrencies.map(() => '')
                                });
                            }}
                            className="w-full"
                            placeholder="Выберите валюты..."
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700">Мин. сумма сделки</label>
                        <input
                            type="number"
                            value={newOffer.minDealAmount}
                            onChange={(e) => setNewOffer({ ...newOffer, minDealAmount: parseFloat(e.target.value) })}
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Мин. сумма"
                            min="0"
                            step="any"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700">Макс. сумма сделки</label>
                        <input
                            type="number"
                            value={newOffer.maxDealAmount}
                            onChange={(e) => setNewOffer({ ...newOffer, maxDealAmount: parseFloat(e.target.value) })}
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Макс. сумма"
                            min="0"
                            step="any"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700">Наценка (%)</label>
                        <input
                            type="number"
                            value={newOffer.markupPercent}
                            onChange={(e) => setNewOffer({ ...newOffer, markupPercent: parseFloat(e.target.value) })}
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Наценка"
                            min="0"
                            step="any"
                        />
                    </div>
                    {newOffer.fiatCurrency.map((currency, index) => (
                        <div key={currency}>
                            <label className="block text-gray-700">Реквизиты для {currency}</label>
                            <input
                                type="text"
                                value={newOffer.warrantHolderPaymentDetails[index] || ''}
                                onChange={(e) => {
                                    const updatedDetails = [...newOffer.warrantHolderPaymentDetails];
                                    updatedDetails[index] = e.target.value;
                                    setNewOffer({ ...newOffer, warrantHolderPaymentDetails: updatedDetails });
                                }}
                                className="w-full p-2 border rounded"
                                placeholder={`Реквизиты для ${currency}`}
                            />
                        </div>
                    ))}
                </div>
                <button
                    type="submit"
                    className="mt-4 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full"
                >
                    Добавить оферту
                </button>
            </form>
        </div>
    );
};

export default CreateOfferForm;