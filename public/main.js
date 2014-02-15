﻿/// <reference path="scripts/jquery-1.10.2-vsdoc.js" />

function gid(id) {
    return document.getElementById(id);
}

function objRef(obj, str) {
    str = str.split(".");
    for (var i = 0; i < str.length; i++)
        obj = obj[str[i]];
    return obj;
}

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};


// ================================
//   ENGINE
// ================================

// Options

var options = {
    debugMenu: true
};

// Countdown Timer
function countdown(elementID, fn, seconds){
    var seconds = seconds-1;
    var interval = setInterval(function () {
        var minutes = Math.round((seconds - 30) / 60);
        var remainingSeconds = seconds % 60;
        if (remainingSeconds < 10) {
            remainingSeconds = "0" + remainingSeconds;
        }
        gid(elementID).innerHTML = minutes + ":" + remainingSeconds;
        if (seconds === 0) {
            clearInterval(interval);
            fn();
        } else {
            seconds--;
        }
    }, 1000);
}

// Day Controller

var dayCount = 0;

function dayRender(){
    var day = dayCount % 7 + 1;
    var week = Math.floor(dayCount / 7) + 1;
    
    gid("dayCounter").innerHTML = " - Week: " + week + " - Day: " + day;
}

function dayIncome() {
    for (var key in Resource.RawMaterial) {
        //for (var subkey in Resource[key]){
            Resource.RawMaterial[key].changeAmount(Resource.RawMaterial[key].income);
        //}
    }
}

function dailyFunctions(){
    countdown("dayTimer", dailyFunctions, 15);
    dayIncome();
    dayCount++;
    dayRender();
}

// Population

var Population = {
    assigned:           0,
    labourer:           function () { return Population.cap - Population.assigned; },
    cap:                0,

    updatePopulation:   function () { gid("Population").innerHTML = "Used Popluation: " + Population.assigned + "/" + Population.cap; }
};

function calculateHousing(){
    Population.cap = 0;
    for(var key in BuildingHouse){
        Population.cap += BuildingHouse[key].amount * BuildingHouse[key].basePop;
    }
    Population.updatePopulation();
}

function calculateWorkers(){
    Population.assigned = 0;
    for (var key in BuildingPrimary){
        for (var subkey in BuildingPrimary[key]){
            Population.assigned += BuildingPrimary[key][subkey].worker.amount;
        }
    }
    for (var key in BuildingFactory){
        for (var subkey in BuildingFactory[key]){
            Population.assigned += BuildingFactory[key][subkey].worker.amount;
        }
    }

    Population.updatePopulation();
}

// Crafting

var fnCheckCraft = function (num) {
    // If no extra number is passed then automatically check for 1 craft
    if (num == null) {
        num = 1;
    }

    // Cycle through each required resource and check if there's enough in storage. If not then fail
    for (var i = 0; i < this.craftType.length; i++) {
        if (this.craftAmount[i] * num > objRef(window, this.craftType[i]).amount) {
            return false;
        }
    }
    
    // Else return true
    return true;
};

var fnApplyCraft = function (num) {
    // If no extra number is passed then automatically check for 1 craft
    if (num == null) {
        num = 1;
    }

    // Produces 1 unless specified by item
    var produced = 1;

    if (this.hasOwnProperty("producedAmount")) {
        produced = this.producedAmount;
    }

    // If the check returns true then cycle through each resource subtracting the requirement, add the produced amount
    if (this.checkCraft(num)) {
        for (var i = 0; i < this.craftType.length; i++) {
            objRef(window, this.craftType[i]).changeAmount((this.craftAmount[i] * num) * -1);
        }
        this.changeAmount(produced * num);
    }
};


// ================================
//   OBJECT CONSTRUCTORS
// ================================

// --------------------------------
// Resources
// --------------------------------

function resource(strPublicName, strIdName, intAmountCap) {
    // Name handlers
    this.publicName = strPublicName;
    this.idName = strIdName;
    
    // Economics
    this.income = 0;
    this.expense = 0;
    
    // Storage
    this.amount = 0;
    this.amountCap = intAmountCap;
}

// Render the object
resource.prototype.render = function () {
    gid(this.idName).innerHTML = this.publicName + ": " + this.amount;
};

// Change the amount
resource.prototype.changeAmount = function (num) {
    // Change the number to include the changed value "num"
    if (!isNaN(num)) {
        if (this.amount + num > this.amountCap) {
            this.amount = this.amountCap;
        } else if (this.amount + num < 0) {
            this.amount = 0;
        } else {
            this.amount += num;
        }
    }
    // Push the new value to the screen
    this.render();
};


// --------------------------------
// Production Buildings
// --------------------------------

function buildingPrimary(strPublicName, strIdName, intWorkerCap, arrIncomeResource, arrToolIncomeRef, arrToolType, arrCraftType, arrCraftAmount){
    // Names
    this.publicName = strPublicName; // Name that the player sees on the page
    this.idName = strIdName; // Div and button IDs for dynamic rendering

    // Number of buildings
    this.amount = 0;

    // Building income - Array of each for the income calculation loop to easily call it
    this.incomeResource = arrIncomeResource;
    this.toolIncomeRef = arrToolIncomeRef;
    
    // Building tool requirements - What tool the building's worker needs to generate income
    this.toolType = arrToolType;

    // Workers
    this.worker = {
        amount:         0,                                                   // Number of workers employed in this building
        capBase:        intWorkerCap,                                        // Base amount of workers that can be employed as defined by the building
        capModifier:    1,                                                   // Modifer to change the base capapacity per building for any upgrade buffs (May be merged with base instead)
        capTotal:       function(){return this.capBase * this.capModifier;}, // Calculator for total worker capacity - I can't call this when rendering? How do?
        equippedTools:  {}
    };

    this.craftType = arrCraftType;
    this.craftAmount = arrCraftAmount;
}

// Update the HTML on the page
buildingPrimary.prototype.render = function () {
    gid(this.idName).innerHTML = this.publicName + "s: " + this.amount + " - Workers: " + this.worker.amount + "/" + (this.amount * this.worker.capBase);
};

// Add more of this building type
buildingPrimary.prototype.changeAmount = function (num) {
    this.amount += num;
    this.render();
};

// Change worker for the building type - TODO: Have it automatically equip the best tool available
buildingPrimary.prototype.changeWorker = function (num) {
    if (isNaN(num) || num === 0) {          // Check if actually a number
        throw ("Stop trying to divide workers by 0");
    } else if (num > 0) {                   // Calculates the smallest amount it can add without going over any of the caps
        num = Math.min(num, Population.cap - Population.assigned, this.amount * this.worker.capBase - this.worker.amount);
    } else if (num < 0) {                   // Calculates the smallest amount it can subtract without going below 0 on anything - TODO: include unequipping
        num = Math.max(num, this.worker.amount * -1, this.worker.equippedTools.none * -1);
    }
    if (num === 0) {                        // Stop function if nothing to do
        return;
    }

    var oldIncome = [];
    for (var i = 0; i < this.toolType.length; i++) {
        oldIncome.push(this.getIncomeByToolType(this.toolType[i]));
    }

    this.worker.amount += num;              // Change the worker amount
    this.worker.equippedTools.none += num;  // Change the unequipped tools
    calculateWorkers();                     // Calculate total used workers
    for (var i = 0; i < this.toolType.length; i++) {
        this.applyIncomeByToolType(this.toolType[i], oldIncome[i]);
    }
    this.render();                          // Renders updated amounts to the screen
};

// Gets the total of every toolTier from the toolType
buildingPrimary.prototype.getWorkerEquippedToolTotal = function (toolType) {
    var total = 0;
    for (var key in this.worker.equippedTools[toolType]) {
        total += this.worker.equippedTools[toolType][key];
    }
    return total;
};

// Gets the total of every toolType and returns the amount of unequipped workers
buildingPrimary.prototype.getWorkerEquippedToolNone = function () {
    var totals = [];
    for (var i = 0; i < this.toolType.length; i++) {
        totals.push(this.getWorkerEquippedToolTotal(this.toolType[i]));
    }
    return this.worker.amount - totals.max();
};

// Changes the equipped tool amount
buildingPrimary.prototype.changeWorkerEquippedTool = function (num, toolType, toolTier) {
    if (isNaN(num) || num === 0) {          // Check if actually a number
        throw ("Stop trying to divide by 0");
    } else if (num > 0) {                   // Calculates the smallest amount it can add without going over any of the caps
        num = Math.min(num, this.worker.amount - this.getWorkerEquippedToolTotal(toolType), this.worker.equippedTools.none, Tool[toolType][toolTier].amount - Tool[toolType][toolTier].equipped);
    } else if (num < 0) {                   // Calculates the smallest amount it can subtract without going below 0 on anything
        num = Math.max(num, this.worker.equippedTools[toolType][toolTier] * -1, Tool[toolType][toolTier].equipped * -1);
    }
    if (num === 0) {                        // Stop function if nothing to do
        return;
    }

    var oldIncome = this.getIncomeByToolType(toolType);                     // Gets the old income value before making the change

    this.worker.equippedTools[toolType][toolTier] += num;                   // Change the tool's amount
    Tool[toolType][toolTier].changeEquipped(num);                           // Change the number of total equipped tools of that type game wide
    this.worker.equippedTools.none = this.getWorkerEquippedToolNone();      // Update the number of unequipped workers
    this.applyIncomeByToolType(toolType, oldIncome);                        // Applies new income value to the resources
};

// Get income value for tool type
buildingPrimary.prototype.getIncomeByToolType = function (toolType) {
    var total = 0;
    // Collect the income rate of each equipped tool in the catagory
    for (var key in this.worker.equippedTools[toolType]) {
        total += (this.worker.equippedTools[toolType][key] * Tool[toolType][key].incomeRate);
    }
    // Add the carriers for each equipped worker
    if (total > 0) {
        total += Math.min(this.worker.equippedTools.none, this.getWorkerEquippedToolTotal(toolType));
    }
    return total;
};

// Apply changes to income rate of a resource after the tool has been changed in the building
buildingPrimary.prototype.applyIncomeByToolType = function (toolType, oldIncome) {
    // Get position of toolType in the array. Used to compare against resource
    var toolPosition = this.toolType.indexOf(toolType);
    // Loop through each resource for the building, checking if the tool matches the resource
    for (var i = 0; i < this.incomeResource.length; i++) {
        if (toolPosition === this.toolIncomeRef[i]) {
            // Subtract the old value and add the new one to update the income. This means multiple buildings can provide the same resource
            objRef(window, this.incomeResource[i]).income -= oldIncome;
            objRef(window, this.incomeResource[i]).income += this.getIncomeByToolType(toolType);
        }
    }
};

buildingPrimary.prototype.checkCraft = fnCheckCraft;

buildingPrimary.prototype.applyCraft = fnApplyCraft;

// --------------------------------
// Factories
// --------------------------------

function buildingFactory(strPublicName, strIdName, intWorkerCap, arrIncomeResource, arrMachineIncomeRef, arrIncomeRate, arrExpenseResource, arrMachineExpenseRef, arrExpenseRate, arrMachineType, arrCraftType, arrCraftAmount) {
    this.publicName = strPublicName;
    this.idName = strIdName;

    this.amount = 0;

    this.incomeResource = arrIncomeResource;
    this.incomeMachineReference = arrMachineIncomeRef;
    this.incomeRate = arrIncomeRate;

    this.expenseResource = arrExpenseResource;
    this.expenseMachineReference = arrMachineExpenseRef;
    this.expenseRate = arrExpenseRate;

    this.machineType = arrMachineType;
    this.equippedMachines = {};
    this.equippedMachinesOrder = {};
    
    this.worker = {
        amount:             0,                                                   // Number of workers employed in this building
        capBase:            intWorkerCap                                         // Base amount of workers that can be employed as defined by the building
    };

    this.craftType = arrCraftType;
    this.craftAmount = arrCraftAmount;
}

buildingFactory.prototype.render = function (num) {
    gid(this.idName).innerHTML = this.publicName + "s: " + this.amount + " - Workers: " + this.worker.amount + "/" + (this.amount * this.worker.capBase);
};

buildingFactory.prototype.changeAmount = function (num) {
    this.amount += num;
    this.render();
};

buildingFactory.prototype.changeWorker = function (num) {
    if (isNaN(num) || num === 0) {          // Check if actually a number
        throw ("Stop trying to divide workers by 0");
    } else if (num > 0) {                   // Calculates the smallest amount it can add without going over any of the caps
        num = Math.min(num, Population.cap - Population.assigned, this.amount * this.worker.capBase - this.worker.amount);
    } else if (num < 0) {                   // Calculates the smallest amount it can subtract without going below 0 on anything - TODO: include unequipping
        num = Math.max(num, this.worker.amount * -1, this.worker.equippedTools.none * -1);
    }
    if (num === 0) {                        // Stop function if nothing to do
        return;
    }

    this.worker += num;
    calculateWorkers();
    this.render;
};

buildingFactory.prototype.getEquippedMachineTotal = function (machineType) {
    var total = 0;
    for (var key in this.equippedMachines[machineType]) {
        total += this.equippedMachines[machineType][key];
    }
    return total;
};

buildingFactory.prototype.changeEquippedMachine = function (num, machineType, machineTier) {
    if (isNaN(num) || num === 0) {
        throw ("Stop trying to divide by 0");
    } else if (num > 0) {
        num = Math.min(num, this.amount - this.getEquippedMachineTotal(machineType), Machine[machineType][machineTier].amount - Machine[machineType][machineTier].equipped)
    } else if (num < 0) {
        num = Math.max(num, this.equippedMachines[machineType][machineTier] * -1, Machine[machineType][machineTier].equipped * -1)
    }
    if (num === 0) {
        return;
    }

    this.equippedMachines[machineType][machineTier] += num;
    Machine[machineType][machineTier].changeEquipped(num);
};

buildingFactory.prototype.getIncomeByMachineType = function (machineType) {
    var total = 0;
    var remainingWorkers = this.worker.amount;

    if (machineType === "None") {
        total = this.worker.amount * this.incomeRate;
    } else {
        // Sorting and calculation goes here
        return;
    }
}

buildingFactory.prototype.checkCraft = fnCheckCraft;

buildingFactory.prototype.applyCraft = fnApplyCraft;


// --------------------------------
// Housing Buildings
// --------------------------------

function buildingHouse(strPublicName, strIdName, intBasePop, arrCraftType, arrCraftAmount){
    this.publicName = strPublicName;
    this.idName = strIdName;

    this.amount = 0;
    this.basePop = intBasePop;
    //this.popModifier = 0; TODO: Add tech tree modifiers here

    this.craftType = arrCraftType;
    this.craftAmount = arrCraftAmount;
}

// Update the HTML on the page
buildingHouse.prototype.render = function () {
    gid(this.idName).innerHTML = this.publicName + "s: " + this.amount + " - Population: " + (this.amount * this.basePop);
};

// Add more of this building type
buildingHouse.prototype.changeAmount = function (num) {
    this.amount += num;
    calculateHousing();
    this.render();
};

buildingHouse.prototype.checkCraft = fnCheckCraft;

buildingHouse.prototype.applyCraft = fnApplyCraft;


// --------------------------------
// Tools
// --------------------------------

function tool(strPublicName, strIdName, intIncomeRate, arrCraftType, arrCraftAmount){
    this.publicName = strPublicName;
    this.idName = strIdName;

    this.amount = 0;
    this.equipped = 0;

    this.incomeRate = intIncomeRate;

    this.craftType = arrCraftType;
    this.craftAmount = arrCraftAmount;
}

// Update the HTML on the page
tool.prototype.render = function () {
    gid(this.idName).innerHTML = this.publicName + ": " + this.equipped + "/" + this.amount;
};

// Change the amount
tool.prototype.changeAmount = function (num) {
    // Change the number to include the changed value "num"
    if (!isNaN(num)) {
        if (this.amount + num < 0) {
            this.amount = 0;
        } else {
            this.amount += num;
        }
    }
    this.render();
};

// Changes equipped total
tool.prototype.changeEquipped = function (num) {
    this.equipped += num; // Temporary
    this.render();
};

tool.prototype.checkCraft = fnCheckCraft;

tool.prototype.applyCraft = fnApplyCraft;


// --------------------------------
// Items
// --------------------------------

function item(strPublicName, strIdName, intProducedAmount, arrCraftType, arrCraftAmount){
    this.publicName = strPublicName;
    this.idName = strIdName;

    this.amount = 0;

    this.producedAmount = intProducedAmount;
    this.craftType = arrCraftType;
    this.craftAmount = arrCraftAmount;
}

item.prototype.render = function (){
    gid(this.idName).innerHTML = this.publicName + ": " + this.amount;
}

item.prototype.changeAmount = function (num) {
    this.amount += num;
    this.render();
};

item.prototype.checkCraft = fnCheckCraft;

item.prototype.applyCraft = fnApplyCraft;


// --------------------------------
// Machine
// --------------------------------

function machine(strPublicName, strIdName, intTierMultiplier, arrCraftType, arrCraftAmount){
    this.publicName = strPublicName;
    this.idName = strIdName;

    this.amount = 0;
    this.equipped = 0;

    this.tierMultiplier = intTierMultiplier;
    
    this.craftType = arrCraftType;
    this.crafTAmount = arrCraftAmount;
}

machine.prototype.render = function () {
    gid(this.idName).innerHTML = this.publicName + ": " + this.equipped + "/" + this.amount;
};

machine.prototype.changeAmount = function (num) {
    this.amount += num;
    this.render();
};

machine.prototype.changeEquipped = function (num) {
    this.equipped += num;
    this.render();
};

machine.prototype.checkCraft = fnCheckCraft;

machine.prototype.applyCraft = fnApplyCraft;


// ================================
//   OBJECT DEFINITIONS
// ================================

var Resource = {
    RawMaterial: {                         // Public Name       ID Name         Cap
        Clay:           new resource        ("Clay",            "Clay",         200),
        Logs:           new resource        ("Logs",            "Logs",         200),
        Stone:          new resource        ("Uncut Stone",     "Stone",        200),
        Skins:          new resource        ("Animal Skins",    "Skins",        200)
    },
    Construction: {                        // Public Name       ID Name         Cap
        Planks:         new resource        ("Planks",          "Planks",       200),
        StoneBricks:    new resource        ("Stone Bricks",    "StoneBricks",  200),
        ClayBricks:     new resource        ("Clay Bricks",     "ClayBricks",   200)
    },
    Fuel: {                                // Public Name       ID Name         Cap
        Firewood:       new resource        ("Firewood",        "Firewood",     200),
        Charcoal:       new resource        ("Charcoal",        "Charcoal",     200),
        Coal:           new resource        ("Coal",            "Coal",         200),
        CoalCoke:       new resource        ("Coal Coke",       "CoalCoke",     200),
        Peat:           new resource        ("Peat",            "Peat",         200)
    },
    Ore: {                                 // Public Name       ID Name         Cap
        Cinnabar:       new resource        ("Cinnabar Ore",    "OreCinnabar",  200),
        Copper:         new resource        ("Copper Ore",      "OreCopper",    200),
        Galena:         new resource        ("Galena Ore",      "OreGalena",    200),
        Gold:           new resource        ("Gold Ore",        "OreGold",      200),
        Iron:           new resource        ("Iron Ore",        "OreIron",      200),
        Silver:         new resource        ("Silver Ore",      "OreSilver",    200),
        Tin:            new resource        ("Tin Ore",         "OreTin",       200)
    },
    Ingot: {                               // Public Name       ID Name         Cap
        Bronze:         new resource        ("Bronze Ingot",    "IngotBronze",  200),
        Copper:         new resource        ("Copper Ingot",    "IngotCopper",  200),
        Gold:           new resource        ("Gold Ingot",      "IngotGold",    200),
        Iron:           new resource        ("Iron Ingot",      "IngotIron",    200),
        Lead:           new resource        ("Lead Ingot",      "IngotLead",    200),
        Silver:         new resource        ("Silver Ingot",    "IngotSilver",  200),
        Steel:          new resource        ("Steel Ingot",     "IngotSteel",   200),
        Tin:            new resource        ("Tin Ingot",       "IngotTin",     200)
    },
    FoodRaw: {                             // Public Name       ID Name         Cap
        GrainBarley:    new resource        ("Barley Grain",    "RawBarley",    200),
        GrainWheat:     new resource        ("Wheat Grain",     "RawWheat",     200),
        Meat:           new resource        ("Meat",            "RawMeat",      200)
    },
    FoodIngredient: {                      // Public Name       ID Name         Cap
        FlourWheat:     new resource        ("Wheat Flour",     "FlourWheat",   200)
    },
    FoodCooked: {                          // Public Name       ID Name         Cap
        Bread:          new resource        ("Bread",           "Bread",        200)
    }
};

var BuildingPrimary = {
    Primary: {                             // Public Name       ID Name       Cap   Income Resource                                             Income Tool     Tool Type
        CampClay:       new buildingPrimary ("Clay Pit",        "CampClay",     5,  ["Resource.RawMaterial.Clay"],                              [0],            ["Shovel"],
                                            ["Resource.RawMaterial.Logs"],
                                            [50]),
        CampLogs:       new buildingPrimary ("Lumber Camp",     "CampLogs",     5,  ["Resource.RawMaterial.Logs"],                              [0],            ["Axe"],
                                            ["Resource.RawMaterial.Logs"],
                                            [50]),
        CampStone:      new buildingPrimary ("Stone Quarry",    "CampStone",    5,  ["Resource.RawMaterial.Stone"],                             [0],            ["Pickaxe"],
                                            ["Resource.RawMaterial.Logs"],
                                            [50]),
        CampHunting:    new buildingPrimary ("Hunting Camp",    "CampHunting",  5,  ["Resource.RawMaterial.Skins", "Resource.FoodRaw.Meat"],    [0, 1],         ["Knife", "Hunting"],
                                            ["Resource.RawMaterial.Logs"],
                                            [50])
    },
    Mine: {                                // Public Name       ID Name       Cap   Income Resource                         Income Tool     Tool Type
        Coal:           new buildingPrimary ("Coal Mine",       "MineCoal",     5,  ["Resource.Fuel.Coal"],                 [0],            ["Pickaxe"]),
        Copper:         new buildingPrimary ("Copper Mine",     "MineCopper",   5,  ["Resource.Ore.Copper"],                [0],            ["Pickaxe"]),
        Galena:         new buildingPrimary ("Lead Mine",       "MineGalena",   5,  ["Resource.Ore.Galena"],                [0],            ["Pickaxe"]),
        Gold:           new buildingPrimary ("Gold Mine",       "MineGold",     5,  ["Resource.Ore.Gold"],                  [0],            ["Pickaxe"]),
        Iron:           new buildingPrimary ("Iron Mine",       "MineIron",     5,  ["Resource.Ore.Iron"],                  [0],            ["Pickaxe"]),
        Silver:         new buildingPrimary ("Silver Mine",     "MineSilver",   5,  ["Resource.Ore.Silver"],                [0],            ["Pickaxe"]),
        Tin:            new buildingPrimary ("Tin Mine",        "MineTine",     5,  ["Resource.Ore.Tin"],                   [0],            ["Pickaxe"])
    }
};

var BuildingFactory = {
    Construction: {
        Sawmill:        new buildingFactory ("Sawmill",         "ConstructionSawmill",  5,  ["Resource.Construction.Planks"],   [0],    [4],    ["Resource.RawMaterial.Logs"],  [0],    [1],    ["Saw"],
                                            ["Resource.RawMaterial.Logs"],
                                            [100])
    },
    Smelting: {
        
    }
}

var BuildingHouse = {                      // Public Name       ID Name         Pop
    TentSmall:          new buildingHouse   ("Small Tent",      "TentSmall",    1,
                                            ["Resource.RawMaterial.Skins"],
                                            [20]),
    TentLarge:          new buildingHouse   ("Large Tent",      "TentLarge",    2,
                                            ["Resource.RawMaterial.Skins"],
                                            [40]),
    HutSmall:           new buildingHouse   ("Small Hut",       "HutSmall",     4,
                                            ["Resource.RawMaterial.Logs"],
                                            [100])
};

var Tool = {
    Axe: {                                 // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Axe",      "AxeCopper",        2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Axe",      "AxeBronze",        4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Axe",        "AxeIron",          8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Axe",       "AxeSteel",         16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Pickaxe: {                             // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Pickaxe",  "PickaxeCopper",    2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Pickaxe",  "PickaxeBronze",    4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Pickaxe",    "PickaxeIron",      8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Pickaxe",   "PickaxeSteel",     16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Saw: {                                 // Public Name       ID Name             Income Rate
        Iron:           new tool            ("Iron Saw",        "SawIron",          8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Steel:          new tool            ("Steel Saw",       "SawSteel",         16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [2,                         1])
    },
    Hoe: {                                 // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Hoe",      "HoeCopper",        2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Hoe",      "HoeBronze",        4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Hoe",        "HoeIron",          8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Hoe",       "HoeSteel",         16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Shovel: {                              // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Shovel",   "ShovelCopper",     2
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Shovel",   "ShovelBronze",     4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Shovel",     "ShovelIron",       8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Shovel",    "ShovelSteel",      16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Sickle: {                              // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Sickle",   "SickleCopper",     2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Sickle",   "SickleBronze",     4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Sickle",     "SickleIron",       8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Sickle",    "SickleSteel",      16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Gold:           new tool            ("Gold Sickle",     "SickleGold",       4,
                                            ["Resource.Ingot.Gold",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Scythe: {                              // Public Name       ID Name             Income Rate
        Copper:         new tool            ("Copper Scythe",   "ScytheCopper",     2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Bronze:         new tool            ("Bronze Scythe",   "ScytheBronze",     4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Iron:           new tool            ("Iron Scythe",     "ScytheIron",       8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Steel:          new tool            ("Steel Scythe",    "ScytheSteel",      16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [2,                         1])
    },
    Hammer: {                              // Public Name       ID Name             Income Rate
        Stone:          new tool            ("Stone Hammer",    "HammerStone",      1,
                                            ["Resource.RawMaterial.Stone",  "Item.Component.ToolHandle"],
                                            [2,                             1]),
        Copper:         new tool            ("Copper Hammer",   "HammerCopper",     2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Bronze:         new tool            ("Bronze Hammer",   "HammerBronze",     4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Iron:           new tool            ("Iron Hammer",     "HammerIron",       8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [2,                         1]),
        Steel:          new tool            ("Steel Hammer",    "HammerSteel",      16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [2,                         1])
    },
    Spear: {                               // Public Name       ID Name             Income Rate
        Wood:           new tool            ("Spear",           "SpearWood",        1,
                                            ["Item.Component.ToolHandle"],
                                            [1]),
        Copper:         new tool            ("Copper Spear",    "SpearCopper",      2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Spear",    "SpearBronze",      4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Spear",      "SpearIron",        8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Spear",     "SpearSteel",       16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Hunting: {                             // Public Name       ID Name             Income Rate
        Spear:          new tool            ("Hunting Spear",   "HuntingSpear",     2,
                                            ["Item.Component.ToolHandle"],
                                            [1]),
        Hunting:        new tool            ("Hunting Bow",     "HuntingBow",       4),
        Reflex:         new tool            ("Reflex Bow",      "HuntingReflexBow", 8)
    },
    Knife: {                               // Public Name       ID Name             Income Rate
        Stone:          new tool            ("Stone Knife",     "KnifeStone",       1,
                                            ["Resource.RawMaterial.Stone",  "Item.Component.ToolHandle"],
                                            [1,                             1]),
        Copper:         new tool            ("Copper Knife",    "KnifeCopper",      2,
                                            ["Resource.Ingot.Copper",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Bronze:         new tool            ("Bronze Knife",    "KnifeBronze",      4,
                                            ["Resource.Ingot.Bronze",   "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Iron:           new tool            ("Iron Knife",      "KnifeIron",        8,
                                            ["Resource.Ingot.Iron",     "Item.Component.ToolHandle"],
                                            [1,                         1]),
        Steel:          new tool            ("Steel Knife",     "KnifeSteel",       16,
                                            ["Resource.Ingot.Steel",    "Item.Component.ToolHandle"],
                                            [1,                         1])
    },
    Fishing: {                             // Public Name       ID Name             Income Rate
        Pole:           new tool            ("Fishing Pole",    "FishingPole",      4),
        Net:            new tool            ("Fishing Net",     "FishingNet",       16)
    }
};

var Item = {
    Component: {                           // Public Name           ID Name             Produces
        WoodenShaft:        new item        ("Wooden Shaft",        "WoodenShaft",      8,
                                            ["Resource.RawMaterial.Logs"],
                                            [1]),
        ToolHandle:         new item        ("Tool Handle",         "ToolHandle",       2,
                                            ["Item.Component.WoodenShaft"],
                                            [1])
    },
    Gearing: {                             // Public Name           ID Name             Produces
        GearWood:           new item        ("Wood Gear Cog",       "GearWood",         5,
                                            ["Resource.RawMaterial.Logs"],
                                            [1]),
        DriveshaftWood:     new item        ("Wood Driveshaft",     "DriveshaftWood",   4,
                                            ["Resource.RawMaterial.Logs"],
                                            [1]),
        GearboxWood:        new item        ("Wood Gearbox",        "GearboxWood",      1,
                                            ["Item.Component.DriveshaftWood",   "Item.Component.GearWood"],
                                            [2,                                 10])
    }
};

var Machine = {
    Saw: {                                 // Public Name           ID Name             Multiplies
        Basic:              new machine     ("Sawmill Saw",         "SawBasic",         1,
                                            ["Item.Component.GearboxWood"],
                                            [1]),
        Advanced:           new machine     ("Advanced Saw",        "SawAdvanced",      2,
                                            ["Item.Component.GearboxWood"],
                                            [4])
    }};


// ================================
//   OBJECT REFERENCE FUNCTIONS
// ================================

// Populate buildingPrimary.worker.equippedTool with each toolType to store totals of each equipped in that building type
buildingPrimary.prototype.listWorkerTools = function () {
    // Loop through the toolType array
    for (var i = 0; i < this.toolType.length; i++) {
        // Create the tool type key
        this.worker.equippedTools[this.toolType[i]] = {};
        // Loop through each tier of tool for that toolType
        for (var property in Tool[this.toolType[i]]) {
            // This line is needed to make sure that it doesn't perform the iteration over inherited properties
            if (Tool[this.toolType[i]].hasOwnProperty(property)) {
                // Create the tool tier key
                this.worker.equippedTools[this.toolType[i]][property] = 0;
            }
        }
    }
    // Create a key for unequipped worker
    this.worker.equippedTools.none = 0;
};

// Populate buildingFactory.worker.equippedMachine with each machineType to store totals of each equipped in that building type
buildingFactory.prototype.listMachines = function () {
    // Loop through the toolType array
    for (var i = 0; i < this.machineType.length; i++) {
        // Checks if the building actually needs a tool
        if (this.machineType[i] !== "None"){
            // Create the machine type key
            this.equippedMachines[this.machineType[i]] = {};
            // Loop through each tier of tool for that toolType
            for (var key in Machine[this.machineType[i]]) {
                // This line is needed to make sure that it doesn't perform the iteration over inherited properties
                if (Machine[this.machineType[i]].hasOwnProperty(key)) {
                    // Create the tool tier key
                    this.equippedMachines[this.machineType[i]][key] = 0;
                }
            }
        }
    }
};

// Sorts machines into order of the tier multiplier to calculate income
buildingFactory.prototype.sortMachines = function () {
    for (var i = 0; i < this.machineType.length; i++) {
        if (this.machineType[i] !== "None") {
            this.equippedMachinesOrder[this.machineType[i]] = Object.keys(Machine[this.machineType[i]]);
            //this.equippedMachinesOrder[this.machineType[i]].sort(function(a, b){
            //    return Machine[this.machineType[i]][a].tierMultiplier > Machine[this.machineType[i]][b].tierMultiplier ? -1 : Machine[this.machineType[i]][a].tierMultiplier == Machine[this.machineType[i]][b].tierMultiplier ? 0 : 1;
            //})
        }
    }
}

// Function to be run on load to populate the rest of the references
function pageLoadDefinitions(){
    // Populate equippedTool for each primary producer
    for (var key in BuildingPrimary){
        for (var subkey in BuildingPrimary[key]){
            BuildingPrimary[key][subkey].listWorkerTools();
        }
    }
    // Populate equippedMachine for each factory type
    for (var key in BuildingFactory){
        for (var subkey in BuildingFactory[key]){
            BuildingFactory[key][subkey].listMachines();
        }
    }
}


// ================================
//   RENDERING
// ================================

//function pageLayout(){
//    
//}

function init(){
    dayRender();

    Population.updatePopulation();

    for(var key in Resource.RawMaterial){
        console.log(key);
        Resource.RawMaterial[key].render();
    }
    for (var key in Tool.Axe){
        console.log(key);
        Tool.Axe[key].render();
    }
    for (var key in BuildingHouse){
        console.log(key);
        BuildingHouse[key].render();
    }
    for (var key in BuildingPrimary.Primary){
        console.log(key);
        BuildingPrimary.Primary[key].render();
    }
    for (var key in Item.Component){
        console.log(key);
        Item.Component[key].render();
    }
}

$(document).ready(function () {
    countdown("dayTimer", dailyFunctions, 15);
    pageLoadDefinitions();
    init();
    debugGenerateResources();
    debugGenerateTools();
    debugGenerateBuildingPrimary();
    debugGenerateBuildingHouse();
});

// Debugging Menu

$(document).ready(function () {
    $("#debug-button").click(function () {
        $("#debug-div").slideToggle("slow");
    });

    if (options.debugMenu === true) {
        $("#debug").css("display", "block");
    }

    $("#debug-tabs").tabs();
});

function debugChangeInputValue(num, id){
    var v = parseInt(gid(id).value);
    v = isNaN(v) ? 0 : v;
    v += num;
    gid(id).value = v;
}

function debugGenerateResources(){
    for (var key in Resource) {
        for (var subkey in Resource[key]){
            $("#debug-tab-resources").append(
                "<div id='debugString" + Resource[key][subkey].idName + "'>" +
                    Resource[key][subkey].publicName + ": " +
                    "<button onclick='debugChangeInputValue(-10, \"debugInput" + Resource[key][subkey].idName + "\")'>--</button>" +
                    "<button onclick='debugChangeInputValue(-1, \"debugInput" + Resource[key][subkey].idName + "\")'>-</button>" +
                    "<input type='text' class='debugInput' id='debugInput" + Resource[key][subkey].idName + "' value='0' />" +
                    "<button onclick='debugChangeInputValue(1, \"debugInput" + Resource[key][subkey].idName + "\")'>+</button>" +
                    "<button onclick='debugChangeInputValue(10, \"debugInput" + Resource[key][subkey].idName + "\")'>++</button>" +
                    "<button onclick='Resource." + key + "." + subkey + ".changeAmount(parseInt(gid(\"debugInput" + Resource[key][subkey].idName + "\").value))'>Apply</button>" +
                "</div>"
            );
        }
    }
}

function debugGenerateTools(){
    for (var key in Tool){
        for (var subkey in Tool[key]) {
            $("#debug-tab-tools").append(
                "<div id='debugString" + Tool[key][subkey].idName + "'>" +
                    Tool[key][subkey].publicName + ": " +
                    "<button onclick='debugChangeInputValue(-10, \"debugInput" + Tool[key][subkey].idName + "\")'>--</button>" +
                    "<button onclick='debugChangeInputValue(-1, \"debugInput" + Tool[key][subkey].idName + "\")'>-</button>" +
                    "<input type='text' class='debugInput' id='debugInput" + Tool[key][subkey].idName + "' value='0' />" +
                    "<button onclick='debugChangeInputValue(1, \"debugInput" + Tool[key][subkey].idName + "\")'>+</button>" +
                    "<button onclick='debugChangeInputValue(10, \"debugInput" + Tool[key][subkey].idName + "\")'>++</button>" +
                    "<button onclick='Tool." + key + "." + subkey + ".changeAmount(parseInt(gid(\"debugInput" + Tool[key][subkey].idName + "\").value))'>Apply</button>" +
                "</div>"
            )
        }
    }
}

function debugGenerateBuildingPrimary(){
    for (var key in BuildingPrimary){
        for (var subkey in BuildingPrimary[key]) {
            $("#debug-tab-buildings").append(
                "<div id='debugString" + BuildingPrimary[key][subkey].idName + "'>" +
                    BuildingPrimary[key][subkey].publicName + ": " +
                    "<button onclick='debugChangeInputValue(-10, \"debugInput" + BuildingPrimary[key][subkey].idName + "\")'>--</button>" +
                    "<button onclick='debugChangeInputValue(-1, \"debugInput" + BuildingPrimary[key][subkey].idName + "\")'>-</button>" +
                    "<input type='text' class='debugInput' id='debugInput" + BuildingPrimary[key][subkey].idName + "' value='0' />" +
                    "<button onclick='debugChangeInputValue(1, \"debugInput" + BuildingPrimary[key][subkey].idName + "\")'>+</button>" +
                    "<button onclick='debugChangeInputValue(10, \"debugInput" + BuildingPrimary[key][subkey].idName + "\")'>++</button>" +
                    "<button onclick='BuildingPrimary." + key + "." + subkey + ".changeAmount(parseInt(gid(\"debugInput" + BuildingPrimary[key][subkey].idName + "\").value))'>Apply</button>" +
                "</div>"
            );
        }
    }
}

function debugGenerateBuildingHouse(){
    for (var key in BuildingHouse){
        $("#debug-tab-houses").append(
            "<div id='debugString" + BuildingHouse[key].idName + "'>" +
                BuildingHouse[key].publicName + ": " +
                "<button onclick='debugChangeInputValue(-10, \"debugInput" + BuildingHouse[key].idName + "\")'>--</button>" +
                "<button onclick='debugChangeInputValue(-1, \"debugInput" + BuildingHouse[key].idName + "\")'>-</button>" +
                "<input type='text' class='debugInput' id='debugInput" + BuildingHouse[key].idName + "' value='0' />" +
                "<button onclick='debugChangeInputValue(1, \"debugInput" + BuildingHouse[key].idName + "\")'>+</button>" +
                "<button onclick='debugChangeInputValue(10, \"debugInput" + BuildingHouse[key].idName + "\")'>++</button>" +
                "<button onclick='BuildingHouse." + key + ".changeAmount(parseInt(gid(\"debugInput" + BuildingHouse[key].idName + "\").value))'>Apply</button>" +
            "</div>"
        );
    }
}