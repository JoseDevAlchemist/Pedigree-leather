# Pedigree Leather workbook inventory reconciliation

Production project `scvscxbxfpjqbqkfkset`. The five committed receipts cover **78 new products, 185 colour variants, 129 EU size entries and 642 opening units**. The audit found zero reconciliation mismatches. Opening units are the committed import quantities.

| Batch | Products | Colours | EU size entries | Opening units | Production receipt |
| --- | ---: | ---: | ---: | ---: | --- |
| 02 · CN Bags A | 11 | 39 | 0 | 54 | `700378b8acdbe971df93371b101b3a7dd9e836ebc4319a2dd81f0238eb43fcf5` |
| 04 · CN Shoes B | 4 | 6 | 21 | 28 | `3cb323adc97ab96fdd5d9989b4a9953a3f1e968193236c3ec9b0c7bacb0359db` |
| 03 · CN Shoes A | 12 | 15 | 47 | 63 | `3511fedb67f755b8cb20eb4ac8f99935c26126b1c888f6521ce715728dd2c694` |
| 08 · Broadway Shoes | 10 | 11 | 61 | 170 | `f1ea627631d1ed2cdaad0945fcb1625fe3d673132abaf2d0531d090dcc89f078` |
| 05 · CN Bags B | 41 | 114 | 0 | 327 | `6102a8a5020097237d22fe9917e3f5608a1f374b9e93ff927c884fddecdac784` |

Batch 05’s receipt was recorded at `2026-11-21T12:54:55.175173Z`. All 41 bags remained unpublished drafts. Independent production checks confirmed zero duplicate codes, skipped products, or image rows. Before-and-after fingerprints matched for existing records across 21 relations.

## Existing products that require a physical count

| Existing code and workbook row | Colour | Workbook units | Production colour balance at reconciliation |
| --- | --- | ---: | --- |
| LB-2207 · CN 92 | Black | 4 | No colour row |
| LB-2207 · CN 92 | Milk White | 5 | No colour row |
| LB-2207 · CN 92 | Caramel | 4 | No colour row |
| LB-2207 · CN 92 | Peacock Blue | 4 | 7, recorded as Peacock blue |
| LB-2207 · CN 92 | Oil Fruit Green | 4 | No colour row |
| LB-2207 · CN 92 | Coffee | 3 | No colour row |
| **LB-2207 total** | | **24** | **7** |
| LB-532 · CN 5 | Black | 2 | 0 |
| LB-532 · CN 5 | Khaki | 1 | No colour row |
| LB-532 · CN 5 | Caramel | 1 | No colour row |
| LB-532 · CN 5 | Almond Green | 1 | No colour row |
| **LB-532 total** | | **5** | **0** |

Count each listed colour physically, confirm the Peacock Blue identity, and decide whether the missing colour records should be added. Both codes were excluded from automatic stock changes. A missing colour row leaves the physical quantity unknown.

## Other workbook holds

The [row-by-row exception CSV](99-exceptions.csv) retains all 161 entries across 55 source rows, including cell references and recorded values.

| Source rows | Open decision |
| --- | --- |
| VN 4–39 | Obtain counts and resolve duplicate codes, inconsistent names and missing, zero or conflicting prices where flagged. |
| CN 22 · SS-AM4140 | Confirm the colour and size-level quantities. |
| CN 26 · LSS-99051 | Verify the EU 41 quantity. Cell L26 contains `]`. |
| CN 39–50 | Resolve product codes and uncoded colourway identities. |
| CN 77 · LB-3301 | Confirm the selling price and recorded colour quantities. The source price is fractional. |
| CN 104 · LSS-2125 | Obtain the missing inventory quantities. |
| CN 107–109 · LB-A219, LB-A273, LB-A260 | Obtain the EU size allocations for the recorded colour quantities. |

Any inventory adjustment requires separate approval.
