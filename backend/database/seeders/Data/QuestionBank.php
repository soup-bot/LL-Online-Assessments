<?php

namespace Database\Seeders\Data;

/**
 * The exam content used by the seeders, written the way a teacher would type it. Each helper
 * returns question definitions; `attributes()` turns one into the columns of a `questions` row.
 */
class QuestionBank
{
    public const BLANK = '________';

    /** @return array<string, mixed> */
    public static function mcq(string $prompt, array $options, string $correct, int $points = 1, bool $approved = false): array
    {
        return compact('prompt', 'options', 'correct', 'points', 'approved') + ['kind' => 'mcq'];
    }

    public static function trueFalse(string $prompt, bool $correct, bool $approved = false): array
    {
        return ['kind' => 'true_false', 'prompt' => $prompt, 'correct' => $correct, 'points' => 1, 'approved' => $approved];
    }

    public static function fill(string $prompt, array $accepted, bool $approved = false): array
    {
        return ['kind' => 'fill_blank', 'prompt' => $prompt, 'accepted' => $accepted, 'points' => 1, 'approved' => $approved];
    }

    public static function written(string $prompt, int $points, array $markingPoints, bool $approved = false): array
    {
        return ['kind' => 'written', 'prompt' => $prompt, 'points' => $points, 'markingPoints' => $markingPoints, 'approved' => $approved];
    }

    /** One definition -> the columns of a `questions` row (json columns already encoded). */
    public static function attributes(int $examId, int $position, array $q): array
    {
        $options = null;
        $key = match ($q['kind']) {
            'mcq' => ['correct' => $q['correct']],
            'true_false' => ['correct' => $q['correct']],
            'fill_blank' => ['accepted' => $q['accepted']],
            'written' => ['markingPoints' => $q['markingPoints']],
        };

        if ($q['kind'] === 'mcq') {
            $options = [];
            foreach ($q['options'] as $i => $text) {
                $options[] = ['key' => chr(65 + $i), 'text' => $text];
            }
        }

        return [
            'exam_id' => $examId,
            'position' => $position,
            'kind' => $q['kind'],
            'prompt' => $q['prompt'],
            'points' => $q['points'],
            'options' => $options === null ? null : json_encode($options),
            'answer_key' => json_encode($key),
            'approved' => $q['approved'] ?? false,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /** The brief's exam: eight questions, none approved. */
    public static function unit3(): array
    {
        $b = self::BLANK;

        return [
            self::mcq('For a normal good, what happens to the demand curve when consumers’ incomes rise?', ['It shifts to the right', 'It shifts to the left', 'There is a movement along the curve', 'It becomes vertical'], 'A'),
            self::mcq('Which of these changes the supply of a good?', ['Consumer tastes', 'Costs of production', 'The price of a substitute in consumption', 'The size of the population'], 'B'),
            self::trueFalse('A fall in the price of a good causes a contraction in the quantity demanded.', false),
            self::trueFalse('Price elasticity of demand is negative for most goods.', true),
            self::fill("When quantity supplied is greater than quantity demanded at a given price, there is a {$b}.", ['surplus', 'excess supply']),
            self::fill("The price at which quantity demanded equals quantity supplied is called the {$b} price.", ['equilibrium', 'market clearing']),
            self::written('Explain two reasons why the demand for petrol in the Maldives may be price inelastic.', 4, [
                'Identifies that petrol is a necessity (for transport, boats, generators).',
                'Explains that people must keep buying it when the price rises, so quantity demanded changes little.',
                'Identifies that there are few or no close substitutes.',
                'Explains that consumers cannot easily switch, so demand responds less than proportionately to price.',
            ]),
            self::written('Analyse the effect of a rise in the cost of imported fish feed on the price and quantity of farmed fish sold in the Maldives.', 6, [
                'States that fish feed is a cost of production for fish farms.',
                'Explains that higher costs reduce supply.',
                'Says the supply curve shifts to the left.',
                'Concludes that the equilibrium price rises.',
                'Concludes that the equilibrium quantity falls.',
                'Uses the idea of a contraction along the demand curve, or comments on how big the change is depending on price elasticity of demand.',
            ]),
        ];
    }

    /** An earlier exam with a released result, so the student results screens have history. */
    public static function unit2(): array
    {
        $b = self::BLANK;

        return [
            self::mcq('Which of these makes the supply of a good more price elastic?', ['Firms have plenty of spare capacity', 'Production takes a long time to increase', 'Raw materials are scarce', 'Stocks cannot be stored'], 'A', 1, true),
            self::mcq('A 10% rise in price causes a 20% fall in quantity demanded. What is the price elasticity of demand?', ['-0.5', '-2', '+2', '-10'], 'B', 1, true),
            self::trueFalse('A good with many close substitutes tends to have elastic demand.', true, true),
            self::fill("A product with a price elasticity of demand greater than 1 is said to have {$b} demand.", ['elastic', 'price elastic'], true),
            self::written('Explain why a firm selling a good with elastic demand may cut its price.', 4, [
                'Identifies that a price cut causes a more than proportionate rise in quantity demanded.',
                'Explains that total revenue therefore rises.',
                'Links elasticity to the availability of substitutes.',
                'Develops the chain of reasoning in full sentences.',
            ], true),
        ];
    }

    /** A draft in progress: five questions, three approved, the last still missing its marking points. */
    public static function unit4(): array
    {
        $b = self::BLANK;

        return [
            self::mcq('Which of these is an example of a negative externality?', ['Noise from a nearby building site', 'A free vaccination programme', 'A new bus route', 'A subsidy for solar panels'], 'A', 1, true),
            self::trueFalse('A public good is both non-rival and non-excludable.', true, true),
            self::trueFalse('A tax on a good with negative externalities always lowers the quantity traded.', true, true),
            self::fill("When the market fails to allocate resources efficiently, this is called {$b} failure.", ['market']),
            self::written('Explain why the government might provide street lighting instead of leaving it to private firms.', 4, []),
        ];
    }

    /** Six questions per subject for the generated exams: two mcq, one true/false, one fill, two written. */
    public static function generic(string $subject): array
    {
        $b = self::BLANK;

        return match ($subject) {
            'econ' => [
                self::mcq('Which of these is a factor of production?', ['Labour', 'Inflation', 'A tariff', 'Profit'], 'A'),
                self::mcq('What is the opportunity cost of a choice?', ['The money paid', 'The next best alternative given up', 'The time taken', 'The tax charged'], 'B'),
                self::trueFalse('A price ceiling set below equilibrium creates a shortage.', true),
                self::fill("A tax on a good shifts the {$b} curve to the left.", ['supply']),
                self::written('Explain one benefit and one cost of specialisation.', 4, ['States a benefit such as higher output', 'Explains the benefit', 'States a cost such as boredom or dependence', 'Explains the cost']),
                self::written('Analyse how a rise in interest rates may affect consumer spending.', 6, ['Higher borrowing costs', 'Less credit spending', 'Higher return on saving', 'Falls in consumption', 'Links to aggregate demand', 'Uses an example']),
            ],
            'biz' => [
                self::mcq('Which of these is a stakeholder of a business?', ['Customers', 'Inflation', 'Weather', 'Exchange rates'], 'A'),
                self::mcq('What does a sole trader have?', ['Limited liability', 'Unlimited liability', 'Shareholders', 'A board of directors'], 'B'),
                self::trueFalse('Revenue minus total costs equals profit.', true),
                self::fill("Money a firm gets from selling goods is called {$b}.", ['revenue', 'sales revenue']),
                self::written('Explain two reasons why a business might want to grow.', 4, ['Names a reason such as economies of scale', 'Develops the first reason', 'Names a second reason', 'Develops the second reason']),
                self::written('Analyse the advantages of using social media to advertise.', 6, ['Wide reach', 'Low cost', 'Targeted audience', 'Two-way feedback', 'Links to sales', 'Uses an example']),
            ],
            default => [
                self::mcq('Which of these is a current asset?', ['Inventory', 'A building', 'A vehicle', 'A loan'], 'A'),
                self::mcq('Where is a purchase on credit first recorded?', ['Sales journal', 'Purchases journal', 'Cash book', 'Ledger only'], 'B'),
                self::trueFalse('Depreciation is a cash payment.', false),
                self::fill("Assets minus liabilities equals {$b}.", ['capital', "owner's equity", 'equity']),
                self::written('Explain why a business prepares a trial balance.', 4, ['Checks debits equal credits', 'Helps find errors', 'Prepares for final accounts', 'Notes its limits']),
                self::written('Analyse the effect of charging depreciation on profit.', 6, ['Depreciation is an expense', 'Reduces profit', 'Spreads cost over life', 'Reduces asset value', 'No cash outflow', 'Uses an example']),
            ],
        };
    }
}
