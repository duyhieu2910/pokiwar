const gameConfig = {
    maxHp: 100000,
    maxMana: 3000,
    maxNo: 300,
    turnTime: 15,
    rows: 8,
    cols: 8,
    gemTypes: ['Kiem', 'Giap', 'Mana', 'Lua', 'HP', 'Hut'],
    // Logic mới của Bro
    giapPercentPerGem: 4, // 1 viên giáp giảm 4%
    giapMaxTurns: 2      // Cộng dồn tối đa 2 lượt
};