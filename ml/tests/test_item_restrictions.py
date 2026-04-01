from features.catalogs import build_candidate_pool, CatalogBundle
from features.item_restrictions import get_item_restriction_reasons


def test_item_restriction_reasons_distinguish_patch_and_role() -> None:
    assert get_item_restriction_reasons(
        item_slug="jarvan-i",
        patch="16.6.1",
        role="TOP",
    ) == ["patch-restricted"]
    assert get_item_restriction_reasons(
        item_slug="lucidite-pourpre",
        patch="16.6.1",
        role="ADC",
    ) == ["role-restricted"]
    assert get_item_restriction_reasons(
        item_slug="lucidite-pourpre",
        patch="16.6.1",
        role="MID",
    ) == []


def test_build_candidate_pool_applies_role_restrictions() -> None:
    catalog = CatalogBundle(
      patch="16.6",
      dd_version="16.6.1",
      items=[
          {
              "riotItemId": 3158,
              "slug": "bottes-de-lucidite",
              "goldTotal": 950,
              "category": "boots",
              "isBoots": True,
              "isLegendary": False,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["Boots"],
              "buildsFrom": [1001],
              "buildsInto": [],
              "itemGroups": ["Boots"],
          },
          {
              "riotItemId": 3006,
              "slug": "jambieres-du-berzerker",
              "goldTotal": 1100,
              "category": "boots",
              "isBoots": True,
              "isLegendary": False,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["Boots"],
              "buildsFrom": [1001],
              "buildsInto": [],
              "itemGroups": ["Boots"],
          },
          {
              "riotItemId": 3171,
              "slug": "lucidite-pourpre",
              "goldTotal": 1600,
              "category": "boots",
              "isBoots": True,
              "isLegendary": True,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["Boots"],
              "buildsFrom": [3158],
              "buildsInto": [],
              "itemGroups": ["Boots"],
          },
          {
              "riotItemId": 3172,
              "slug": "jambieres-de-metal",
              "goldTotal": 1600,
              "category": "boots",
              "isBoots": False,
              "isLegendary": True,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["AttackSpeed", "NonbootsMovement"],
              "buildsFrom": [3006],
              "buildsInto": [],
              "itemGroups": ["Boots"],
          },
          {
              "riotItemId": 3001,
              "slug": "jarvan-i",
              "goldTotal": 1500,
              "category": "boots",
              "isBoots": True,
              "isLegendary": True,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["Boots"],
              "buildsFrom": [],
              "buildsInto": [],
              "itemGroups": ["Boots"],
          },
          {
              "riotItemId": 3031,
              "slug": "lame-dinfini",
              "goldTotal": 3500,
              "category": "crit",
              "isBoots": False,
              "isLegendary": True,
              "isConsumable": False,
              "isStarter": False,
              "isActive": True,
              "tags": ["CriticalStrike", "Damage"],
              "buildsFrom": [],
              "buildsInto": [],
              "itemGroups": [],
          },
      ],
      champions=[],
      item_slug_by_id={3006: "jambieres-du-berzerker", 3158: "bottes-de-lucidite", 3171: "lucidite-pourpre", 3172: "jambieres-de-metal", 3001: "jarvan-i", 3031: "lame-dinfini"},
      item_meta_by_slug={
          "jambieres-du-berzerker": {
              "riotItemId": 3006,
              "slug": "jambieres-du-berzerker",
              "isBoots": True,
              "buildsFrom": [1001],
              "itemGroups": ["Boots"],
          },
          "bottes-de-lucidite": {
              "riotItemId": 3158,
              "slug": "bottes-de-lucidite",
              "isBoots": True,
              "buildsFrom": [1001],
              "itemGroups": ["Boots"],
          },
          "lucidite-pourpre": {
              "riotItemId": 3171,
              "slug": "lucidite-pourpre",
              "isBoots": True,
              "buildsFrom": [3158],
              "itemGroups": ["Boots"],
          },
          "jarvan-i": {
              "riotItemId": 3001,
              "slug": "jarvan-i",
              "isBoots": True,
              "buildsFrom": [],
              "itemGroups": ["Boots"],
          },
          "jambieres-de-metal": {
              "riotItemId": 3172,
              "slug": "jambieres-de-metal",
              "isBoots": False,
              "buildsFrom": [3006],
              "itemGroups": ["Boots"],
          },
          "lame-dinfini": {
              "riotItemId": 3031,
              "slug": "lame-dinfini",
              "isBoots": False,
              "buildsFrom": [],
              "itemGroups": [],
          },
      },
      champion_index={},
    )

    adc_pool = build_candidate_pool(
        catalog,
        owned_item_slugs=[],
        gold_available=4000,
        role="ADC",
    )
    mid_pool = build_candidate_pool(
        catalog,
        owned_item_slugs=[],
        gold_available=4000,
        role="MID",
    )

    assert "jarvan-i" not in adc_pool
    assert "lucidite-pourpre" not in adc_pool
    assert "jambieres-de-metal" not in adc_pool
    assert "lucidite-pourpre" in mid_pool


def test_build_candidate_pool_filters_same_family_items_already_owned() -> None:
    catalog = CatalogBundle(
        patch="16.6",
        dd_version="16.6.1",
        items=[
            {
                "riotItemId": 3036,
                "slug": "salutations-de-dominik",
                "goldTotal": 3000,
                "category": "crit",
                "isBoots": False,
                "isLegendary": True,
                "isConsumable": False,
                "isStarter": False,
                "isActive": True,
                "tags": ["CriticalStrike", "Damage"],
                "buildsFrom": [3035],
                "buildsInto": [],
                "itemGroups": ["LastWhisper"],
            },
            {
                "riotItemId": 3033,
                "slug": "rappel-mortel",
                "goldTotal": 3200,
                "category": "crit",
                "isBoots": False,
                "isLegendary": True,
                "isConsumable": False,
                "isStarter": False,
                "isActive": True,
                "tags": ["CriticalStrike", "Damage"],
                "buildsFrom": [3035],
                "buildsInto": [],
                "itemGroups": ["LastWhisper"],
            },
        ],
        champions=[],
        item_slug_by_id={3036: "salutations-de-dominik", 3033: "rappel-mortel"},
        item_meta_by_slug={
            "salutations-de-dominik": {"slug": "salutations-de-dominik", "riotItemId": 3036, "buildsFrom": [3035], "itemGroups": ["LastWhisper"], "isBoots": False},
            "rappel-mortel": {"slug": "rappel-mortel", "riotItemId": 3033, "buildsFrom": [3035], "itemGroups": ["LastWhisper"], "isBoots": False},
        },
        champion_index={},
    )

    pool = build_candidate_pool(
        catalog,
        owned_item_slugs=["salutations-de-dominik"],
        gold_available=4000,
        role="ADC",
    )

    assert "rappel-mortel" not in pool
