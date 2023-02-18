// https://github.com/fainapahanko/Conway-s-Game-Of-Life.git - Optimized by Prefect

class GameOfLife 
{
    constructor() 
    {
        this.cell_size = 5;
        this.dead_color = `#181818`;
        this.alive_color = `#FF756B`;
        this.cells_in_column = Math.floor(canvas.width / this.cell_size);
        this.cells_in_rows = Math.floor(canvas.height / this.cell_size);
        this.active_array = [];
        this.inactive_array = [];

        this.arrayInitialization = () => 
        {
            for (let i = 0; i < this.cells_in_rows; i++) 
            {
                this.active_array[i] = [];
                for (let j = 0; j < this.cells_in_column; j++) 
                {
                    this.active_array[i][j] = (Math.random() < 0.25) ? 1 : 0;
                }
            }

            this.inactive_array = this.active_array;
        };

        this.fillArray = () => 
        {
            for (let i = 0; i < this.cells_in_rows; i++) 
            {
                for (let j = 0; j < this.cells_in_column; j++) 
                {
                    let color;
                    if (this.active_array[i][j] == 1)
                    {
                        color = this.alive_color;
                    }
                    else
                    {
                        color = this.dead_color;
                    }
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(j * this.cell_size, i * this.cell_size, this.cell_size, this.cell_size);
                }
            }
        };

        this.setCellValueHelper = (row, col) => 
        {
            try 
            {
                return this.active_array[row][col];
            }
            catch 
            {
                return 0;
            }
        };

        this.countNeighbors = (row, col) => 
        {
            let total_neighbors = 0;

            total_neighbors += this.setCellValueHelper(row - 1, col - 1);
            total_neighbors += this.setCellValueHelper(row - 1, col);
            total_neighbors += this.setCellValueHelper(row - 1, col + 1);
            total_neighbors += this.setCellValueHelper(row, col - 1);
            total_neighbors += this.setCellValueHelper(row, col + 1);
            total_neighbors += this.setCellValueHelper(row + 1, col - 1);
            total_neighbors += this.setCellValueHelper(row + 1, col);
            total_neighbors += this.setCellValueHelper(row + 1, col + 1);

            return total_neighbors;
        };

        this.updateCellValue = (row, col) => 
        {
            const total = this.countNeighbors(row, col);
            if (total > 4 || total < 3) 
            {
                return 0;
            }
            else if (this.active_array[row][col] === 0 && total === 3) 
            {
                return 1;
            }
            else 
            {
                return this.active_array[row][col];
            }
        };

        this.updateLifeCycle = () => 
        {
            for (let i = 0; i < this.cells_in_rows; i++) 
            {
                for (let j = 0; j < this.cells_in_column; j++) 
                {
                    let new_state = this.updateCellValue(i, j);
                    if (new_state == this.inactive_array[i][j])
                    {
                        continue;
                    }

                    this.inactive_array[i][j] = new_state;

                    let color;
                    if (this.active_array[i][j] == 1)
                    {
                        color = this.alive_color;
                    }
                    else
                    {
                        color = this.dead_color;
                    }
        
                    ctx.fillStyle = color;
                    ctx.fillRect(j * this.cell_size, i * this.cell_size, this.cell_size, this.cell_size);
                }
            }

            this.active_array = this.inactive_array
        };

        this.gameSetUp = () => 
        {
            this.arrayInitialization();

            for (let i = 0; i < this.cells_in_rows; i++) 
            {
                for (let j = 0; j < this.cells_in_column; j++) 
                {
                    let new_state = this.updateCellValue(i, j);
                    this.inactive_array[i][j] = new_state;

                    let color;
                    if (this.active_array[i][j] == 1)
                    {
                        color = this.alive_color;
                    }
                    else
                    {
                        color = this.dead_color;
                    }
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(j * this.cell_size, i * this.cell_size, this.cell_size, this.cell_size);
                }
            }

            this.active_array = this.inactive_array
        };

        this.runGame = () => 
        {
            this.updateLifeCycle();
        };
    }
}
