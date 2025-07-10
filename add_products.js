const SKUMAP = {
    "860009592568": "Post-Bio-GH",
    "860009592551": "Omega-Alg",
    "850016364982": "Edi-DR-BC-SML",
    "864178000275": "Edi-DR-BC-LRG",
    "850016364968": "TS-Edi-HJ-PB",
    "850016364876": "Edi-HJ-PB-SML",
    "850016364883": "Edi-HJ-PB-LRG",
    "850016364890": "Edi-HJ-PB-FAM",
    "850016364951": "TS-Edi-STRESS-PB",
    "850016364838": "Edi-STRESS-PB-SML",
    "850016364852": "Edi-STRESS-PB-LRG",
    "850016364869": "Edi-STRESS-PB-FAM",
    "850016364906": "Edi-DR-SP-SML",
    "850016364913": "Edi-DR-SP-LRG",
    "850016364944": "TS-Edi-STRESS-Pepp",
    "850016364845": "Edi-STRESS-Pepp-SML",
    "850016364821": "Edi-STRESS-Pepp-LRG",
    "860008203403": "100-DR-HO",
    "860008203410": "200-DR-HO",
    "860008203427": "500-DR-HO",
    "860008203434": "750-DR-HO",
    "860009592575": "150-Mini-Stress-HO",
    "860008203441": "300-SR-HO",
    "860008203458": "600-SR-HO",
    "860008203465": "300-HJR-HO",
    "860008203472": "600-HJR-HO",
    "860008221988": "180-CAT-SR",
    "860008876775": "100-Lipe-Ultra",
    "860008876768": "300-Lipe-Ultra",
    "860009592513": "600-Lipe-Ultra",
    "861109000304": "CAP450",
    "850016364586": "SNT30",
    "860009592537": "TS-Itchy-Dry-Shampoo",
    "860008876713": "Itchy & Dry-SK-CT",
    "860009592520": "Itchy-Dry-Shampoo-Gallon",
    "860008876720": "Sensitive-SK-CT",
    "860008876737": "Conditioner-SK-CT",
    "860009592544": "TS-2in1-Shampoo",
    "860008876744": "2in1-SK-CT",
    "860008221971": "SK-PW-RL",
    "1": "Equine2400",
    "2": "Equine1500",
    "3": "SNT10"
};

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://OrderInv_owner:DN6KGMJdapT7@ep-calm-morning-aatv5wic-pooler.westus3.azure.neon.tech/OrderInv?sslmode=require'
});

async function resetAndAddProducts() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // First, delete all existing products
        await client.query('DELETE FROM products');
        console.log('Deleted all existing products');
        
        // Then add all products from SKUMAP
        for (const [upc, productName] of Object.entries(SKUMAP)) {
            try {
                // Remove spaces from product name and add .1
                const cleanProductName = productName.replace(/\s+/g, '') + '.1';
                await client.query(
                    'INSERT INTO products (product_code, available_quantity) VALUES ($1, $2)',
                    [cleanProductName, 20]
                );
                console.log(`Added product: ${cleanProductName}`);
            } catch (err) {
                console.error(`Error processing product ${productName}:`, err);
                throw err;
            }
        }

        await client.query('COMMIT');
        console.log('All products reset and added successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error resetting and adding products:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Run the function
resetAndAddProducts().catch(console.error); 